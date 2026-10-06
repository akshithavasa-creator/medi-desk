/*
  MediDesk frontend API integration
  ---------------------------------
  Neon is NOT called directly from the browser.
  The browser talks to your backend API, and the backend talks to
  Prisma -> Neon PostgreSQL.

  Expected backend endpoints:
    POST /api/auth/login
    POST /api/auth/logout
    GET  /api/me
    GET  /api/doctors
    GET  /api/appointments
    POST /api/appointments
    PATCH /api/appointments/:id/cancel
    GET  /api/records
    GET  /api/messages
    POST /api/messages
    GET  /api/audit
*/

const API_BASE = window.MEDIDESK_API_BASE || "http://localhost:5000/api";

const state = {
  role: "patient",
  user: null,
  appointments: [],
  doctors: []
};

const $ = id => document.getElementById(id);

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    const message = data.message || data.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function setRole(role) {
  state.role = role;
  document.querySelectorAll(".role-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.role === role);
  });

  const roleEmail = {
    patient: "alex@demo.com",
    doctor: "doctor@demo.com",
    admin: "admin@demo.com"
  };

  if ($("email")) $("email").value = roleEmail[role] || "";
}

function setLoggedInUI(user) {
  state.user = user;

  const name = user?.name || "MediDesk User";
  const role = user?.role || "patient";
  const shortName = name.split(" ")[0];

  if ($("sideName")) $("sideName").textContent = name;
  if ($("sideRole")) $("sideRole").textContent = role.charAt(0).toUpperCase() + role.slice(1);
  if ($("sideAvatar")) $("sideAvatar").textContent = initials(name);
  if ($("topAvatar")) $("topAvatar").textContent = initials(name);
  if ($("topName")) $("topName").textContent = name;
  if ($("welcomeName")) $("welcomeName").textContent = shortName;

  document.querySelectorAll("[data-role-only]").forEach(el => {
    el.classList.toggle("hidden", el.dataset.roleOnly !== role);
  });
}

async function login(event) {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    showToast("Enter your email and password.");
    return;
  }

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setLoggedInUI(result.user);

    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    await loadAppData();
    showToast(`Signed in as ${result.user.role}`);
  } catch (error) {
    showToast(error.message);
  }
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (_) {
    // UI still signs out locally if the server is unavailable.
  }

  state.user = null;
  $("appScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  showToast("Signed out safely");
}

function navigate(section) {
  state.currentSection = section;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const target = $(section);
  if (target) target.classList.add("active-page");

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === section);
  });

  $("sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadAppData() {
  try {
    const [me, appointments, doctors] = await Promise.all([
      api("/me"),
      api("/appointments"),
      api("/doctors")
    ]);

    setLoggedInUI(me.user);
    state.appointments = appointments.appointments || [];
    state.doctors = doctors.doctors || [];

    renderDashboardAppointments();
    renderAppointments("all");
    renderDoctors();
    populateDoctorSelect();
  } catch (error) {
    showToast(`Could not load MediDesk data: ${error.message}`);
  }
}

function normalizeAppointment(a) {
  return {
    id: a.id,
    doctor: a.doctor?.name || a.doctorName || "Authorized doctor",
    initials: initials(a.doctor?.name || a.doctorName || "DR"),
    specialty: a.doctor?.specialty || "Clinic visit",
    date: a.dateLabel || a.date || "",
    time: a.timeLabel || a.time || "",
    type: a.type || "In-person",
    status: String(a.status || "UPCOMING").toLowerCase()
  };
}

function renderDashboardAppointments() {
  const list = state.appointments.map(normalizeAppointment)
    .filter(a => a.status === "upcoming");

  if ($("dashboardAppointments")) {
    $("dashboardAppointments").innerHTML = list.length
      ? list.slice(0, 4).map(a => `
        <div class="appointment-item">
          <div class="doctor-avatar">${a.initials}</div>
          <div class="appointment-info">
            <strong>${escapeHTML(a.doctor)}</strong>
            <small>${escapeHTML(a.specialty)} · ${escapeHTML(a.type)}</small>
          </div>
          <div class="appointment-time">
            <strong>${escapeHTML(a.date)}</strong>
            <span>${escapeHTML(a.time)}</span>
          </div>
        </div>`).join("")
      : `<div class="empty-state">No upcoming appointments.</div>`;
  }

  if ($("upcomingCount")) {
    $("upcomingCount").textContent = String(list.length).padStart(2, "0");
  }

  if ($("appointmentBadge")) {
    $("appointmentBadge").textContent = list.length;
  }
}

function renderAppointments(filter = "all") {
  const all = state.appointments.map(normalizeAppointment);
  const list = filter === "all" ? all : all.filter(a => a.status === filter);

  if (!$("appointmentTable")) return;

  $("appointmentTable").innerHTML = list.length
    ? list.map(a => `
      <div class="table-row">
        <div class="table-doctor">
          <div class="doctor-avatar">${a.initials}</div>
          <div>
            <strong>${escapeHTML(a.doctor)}</strong>
            <small>${escapeHTML(a.specialty)}</small>
          </div>
        </div>
        <div class="table-cell">
          <strong>${escapeHTML(a.date)}</strong><br>
          <small>${escapeHTML(a.time)}</small>
        </div>
        <div class="table-cell">${escapeHTML(a.type)}</div>
        <div><span class="badge ${a.status}">
          ${a.status === "upcoming" ? "Upcoming" : "Completed"}
        </span></div>
        <div>
          <button class="row-action"
            onclick="${a.status === "upcoming" ? `cancelAppointment('${encodeURIComponent(a.id)}')` : "showToast('Record details opened')"}">
            ${a.status === "upcoming" ? "Cancel" : "View"}
          </button>
        </div>
      </div>`).join("")
    : `<div class="empty-state">No appointments found.</div>`;
}

async function cancelAppointment(encodedId) {
  const id = decodeURIComponent(encodedId);

  if (!confirm("Cancel this appointment?")) return;

  try {
    await api(`/appointments/${encodeURIComponent(id)}/cancel`, { method: "PATCH" });
    await loadAppData();
    showToast("Appointment cancelled.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderDoctors() {
  if (!$("doctorGrid")) return;

  $("doctorGrid").innerHTML = state.doctors.length
    ? state.doctors.map(d => {
        const name = d.name || "Doctor";
        const specialty = d.specialty || "General Physician";
        return `
          <article class="doctor-card">
            <div class="doctor-card-top">
              <div class="doctor-avatar">${initials(name)}</div>
              <div>
                <h3>${escapeHTML(name)}</h3>
                <div class="specialty">${escapeHTML(specialty)}</div>
              </div>
            </div>
            <div class="rating">★★★★★ <span style="color:#7e899c">${escapeHTML(String(d.rating || "4.9"))}</span></div>
            <div class="doctor-card-info">
              <div><span>Experience</span><strong>${escapeHTML(String(d.experience || "—"))}</strong></div>
              <div><span>Availability</span><strong>${escapeHTML(String(d.nextAvailable || "Check schedule"))}</strong></div>
            </div>
            <button class="primary-btn" onclick="openModalForDoctor('${escapeJS(name)}')">
              Book with doctor →
            </button>
          </article>`;
      }).join("")
    : `<div class="empty-state">No authorized doctors available.</div>`;
}

function populateDoctorSelect() {
  if (!$("doctorSelect")) return;
  $("doctorSelect").innerHTML = state.doctors.map(d =>
    `<option value="${escapeHTML(String(d.id))}">${escapeHTML(d.name)}</option>`
  ).join("");
}

function openModal() {
  $("bookingModal")?.classList.remove("hidden");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if ($("dateSelect")) {
    $("dateSelect").min = tomorrow.toISOString().split("T")[0];
    $("dateSelect").value = tomorrow.toISOString().split("T")[0];
  }
}

function openModalForDoctor(name) {
  openModal();

  const doctor = state.doctors.find(d => d.name === name);
  if (doctor && $("doctorSelect")) {
    $("doctorSelect").value = doctor.id;
  }
}

function closeModal() {
  $("bookingModal")?.classList.add("hidden");
}

async function bookAppointment(event) {
  event.preventDefault();

  try {
    const result = await api("/appointments", {
      method: "POST",
      body: JSON.stringify({
        doctorId: $("doctorSelect").value,
        date: $("dateSelect").value,
        time: $("timeSelect").value,
        type: $("visitType").value
      })
    });

    closeModal();
    await loadAppData();
    navigate("appointments");
    showToast(result.message || "Appointment booked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function sendMessage() {
  const input = $("messageInput");
  const body = input?.value.trim();

  if (!body) return;

  try {
    await api("/messages", {
      method: "POST",
      body: JSON.stringify({ body })
    });

    input.value = "";
    showToast("Secure message sent.");
  } catch (error) {
    showToast(error.message);
  }
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJS(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".role-tab").forEach(btn => {
    btn.addEventListener("click", () => setRole(btn.dataset.role));
  });

  $("showPassword")?.addEventListener("click", () => {
    const input = $("password");
    input.type = input.type === "password" ? "text" : "password";
    $("showPassword").textContent = input.type === "password" ? "Show" : "Hide";
  });

  $("loginForm")?.addEventListener("submit", login);
  $("logoutBtn")?.addEventListener("click", logout);

  $("mobileMenu")?.addEventListener("click", () => $("sidebar")?.classList.add("open"));
  $("closeSidebar")?.addEventListener("click", () => $("sidebar")?.classList.remove("open"));
  $("sidebarOverlay")?.addEventListener("click", () => $("sidebar")?.classList.remove("open"));

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.section));
  });

  document.querySelectorAll("[data-section-target]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.sectionTarget));
  });

  document.querySelectorAll("[data-action='book']").forEach(btn => {
    btn.addEventListener("click", openModal);
  });

  $("bookHeroBtn")?.addEventListener("click", openModal);
  $("bookAppointmentBtn")?.addEventListener("click", openModal);
  $("closeModal")?.addEventListener("click", closeModal);
  $("bookingForm")?.addEventListener("submit", bookAppointment);

  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderAppointments(btn.dataset.filter);
    });
  });

  try {
    const me = await api("/me");
    setLoggedInUI(me.user);
    $("loginScreen")?.classList.add("hidden");
    $("appScreen")?.classList.remove("hidden");
    await loadAppData();
  } catch (_) {
    // Not logged in: keep login screen visible.
  }
});
