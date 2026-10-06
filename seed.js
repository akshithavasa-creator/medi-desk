const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo@12345", 12);

  const patient = await prisma.user.upsert({
    where: { email: "alex@demo.com" },
    update: {},
    create: {
      name: "Alex Kumar",
      email: "alex@demo.com",
      passwordHash,
      role: "PATIENT"
    }
  });

  const doctor = await prisma.user.upsert({
    where: { email: "doctor@demo.com" },
    update: {},
    create: {
      name: "Dr. Priya Patel",
      email: "doctor@demo.com",
      passwordHash,
      role: "DOCTOR",
      specialty: "General Physician",
      experience: "9 years",
      rating: 4.9
    }
  });

  const doctor2 = await prisma.user.upsert({
    where: { email: "doctor2@demo.com" },
    update: {},
    create: {
      name: "Dr. Arjun Rao",
      email: "doctor2@demo.com",
      passwordHash,
      role: "DOCTOR",
      specialty: "Dermatologist",
      experience: "11 years",
      rating: 4.8
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      name: "MediDesk Admin",
      email: "admin@demo.com",
      passwordHash,
      role: "ADMIN"
    }
  });

  await prisma.patientRecord.create({
    data: {
      patientId: patient.id,
      title: "Demo general consultation",
      summary: "Synthetic consultation record for the MediDesk demonstration."
    }
  }).catch(() => {});

  await prisma.consent.upsert({
    where: {
      patientId_doctorId: {
        patientId: patient.id,
        doctorId: doctor.id
      }
    },
    update: { granted: true },
    create: {
      patientId: patient.id,
      doctorId: doctor.id,
      granted: true
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      date: new Date(),
      time: "4:30 PM",
      type: "In-person",
      status: "UPCOMING"
    }
  });

  console.log("MediDesk demo data created.");
  console.log("Patient: alex@demo.com / Demo@12345");
  console.log("Doctor: doctor@demo.com / Demo@12345");
  console.log("Doctor 2: doctor2@demo.com / Demo@12345");
  console.log("Admin: admin@demo.com / Demo@12345");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
