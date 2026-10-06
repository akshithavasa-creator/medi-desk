require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Add it to .env");
}

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://127.0.0.1:5500",
  credentials: true
}));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.medidesk_session;

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid session." });
    }

    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied: your role is not authorized for this action."
      });
    }
    next();
  };
}

async function audit(userId, action, resource, allowed) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, resource, allowed }
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signToken(user);

    res.cookie("medidesk_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000
    });

    await audit(user.id, "LOGIN", "SESSION", true);

    res.json({
      message: "Login successful.",
      user: safeUser(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed." });
  }
});

// LOGOUT
app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await audit(req.user.id, "LOGOUT", "SESSION", true);
  res.clearCookie("medidesk_session");
  res.json({ message: "Logged out." });
});

// CURRENT USER
app.get("/api/me", requireAuth, async (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// DOCTORS — authenticated users can discover active doctors
app.get("/api/doctors", requireAuth, async (req, res) => {
  const doctors = await prisma.user.findMany({
    where: { role: "DOCTOR", active: true },
    select: {
      id: true,
      name: true,
      specialty: true,
      experience: true,
      rating: true
    },
    orderBy: { name: "asc" }
  });

  res.json({ doctors });
});

// APPOINTMENTS — patients see their own; doctors see appointments assigned to them
app.get("/api/appointments", requireAuth, async (req, res) => {
  let where;

  if (req.user.role === "PATIENT") {
    where = { patientId: req.user.id };
  } else if (req.user.role === "DOCTOR") {
    where = { doctorId: req.user.id };
  } else if (req.user.role === "ADMIN") {
    where = {};
  } else {
    return res.status(403).json({ message: "Role not authorized." });
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: { select: { id: true, name: true } }
    },
    orderBy: { date: "asc" }
  });

  res.json({ appointments });
});

// BOOK APPOINTMENT — only patient can create one for themselves
app.post("/api/appointments", requireAuth, requireRole("PATIENT"), async (req, res) => {
  const { doctorId, date, time, type } = req.body;

  if (!doctorId || !date || !time || !type) {
    return res.status(400).json({ message: "Doctor, date, time and type are required." });
  }

  const doctor = await prisma.user.findFirst({
    where: { id: doctorId, role: "DOCTOR", active: true }
  });

  if (!doctor) {
    return res.status(404).json({ message: "Authorized doctor not found." });
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: req.user.id,
      doctorId,
      date: new Date(`${date}T00:00:00`),
      time,
      type,
      status: "UPCOMING"
    }
  });

  await audit(req.user.id, "CREATE_APPOINTMENT", appointment.id, true);

  res.status(201).json({
    message: "Appointment booked successfully.",
    appointment
  });
});

// CANCEL — patient can cancel own appointment; doctor can cancel assigned appointment
app.patch("/api/appointments/:id/cancel", requireAuth, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id }
  });

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const allowed =
    (req.user.role === "PATIENT" && appointment.patientId === req.user.id) ||
    (req.user.role === "DOCTOR" && appointment.doctorId === req.user.id) ||
    req.user.role === "ADMIN";

  await audit(req.user.id, "CANCEL_APPOINTMENT", appointment.id, allowed);

  if (!allowed) {
    return res.status(403).json({
      message: "Access denied: you cannot modify this appointment."
    });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" }
  });

  res.json({ message: "Appointment cancelled.", appointment: updated });
});

// RECORDS — patient sees own; doctor sees records only for patients with a granted consent
app.get("/api/records", requireAuth, async (req, res) => {
  if (req.user.role === "PATIENT") {
    const records = await prisma.patientRecord.findMany({
      where: { patientId: req.user.id },
      orderBy: { createdAt: "desc" }
    });

    await audit(req.user.id, "VIEW_OWN_RECORDS", req.user.id, true);
    return res.json({ records });
  }

  if (req.user.role === "DOCTOR") {
    const records = await prisma.patientRecord.findMany({
      where: {
        patient: {
          consents: {
            some: {
              doctorId: req.user.id,
              granted: true
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    await audit(req.user.id, "VIEW_AUTHORIZED_RECORDS", "PATIENT_RECORDS", true);
    return res.json({ records });
  }

  await audit(req.user.id, "VIEW_RECORDS", "PATIENT_RECORDS", false);
  return res.status(403).json({
    message: "Admins cannot access patient records through this route."
  });
});

// SECURE MESSAGE — simple demo endpoint
app.post("/api/messages", requireAuth, async (req, res) => {
  const { body } = req.body;

  if (!body || typeof body !== "string" || body.length > 2000) {
    return res.status(400).json({ message: "Invalid message." });
  }

  const message = await prisma.message.create({
    data: {
      senderId: req.user.id,
      body
    }
  });

  await audit(req.user.id, "SEND_MESSAGE", message.id, true);

  res.status(201).json({
    message: "Secure message sent.",
    id: message.id
  });
});

// AUDIT LOG — only admins can see audit information
app.get("/api/audit", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: {
      user: { select: { name: true, email: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({ logs });
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "MediDesk API" });
});

app.listen(PORT, () => {
  console.log(`MediDesk API running on http://localhost:${PORT}`);
});
