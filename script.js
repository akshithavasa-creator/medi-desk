const state = {
  role: "patient",
  currentSection: "dashboard",
  appointments: [
    {id:1, doctor:"Dr. Priya Patel", initials:"PP", specialty:"General Physician", date:"Today", time:"4:30 PM", type:"In-person", status:"upcoming"},
    {id:2, doctor:"Dr. Arjun Rao", initials:"AR", specialty:"Dermatology", date:"12 Oct 2026", time:"11:30 AM", type:"Video consultation", status:"upcoming"},
    {id:3, doctor:"Dr. Meera Shah", initials:"MS", specialty:"General Physician", date:"28 Sep 2026", time:"2:00 PM", type:"In-person", status:"completed"},
    {id:4, doctor:"Dr. Arjun Rao", initials:"AR", specialty:"Dermatology", date:"14 Aug 2026", time:"10:00 AM", type:"In-person", status:"completed"}
  ],
  doctors: [
    {name:"Dr. Priya Patel", initials:"PP", specialty:"General Physician", exp:"9 years", rating:"4.9", next:"Today, 4:30 PM", color:""},
    {name:"Dr. Arjun Rao", initials:"AR", specialty:"Dermatologist", exp:"11 years", rating:"4.8", next:"Tomorrow, 11:30 AM", color:"teal"},
    {name:"Dr. Meera Shah", initials:"MS", specialty:"General Physician", exp:"7 years", rating:"4.9", next:"12 Oct, 2:00 PM", color:"purple"},
    {name:"Dr. Kabir Singh", initials:"KS", specialty:"Cardiologist", exp:"14 years", rating:"4.9", next:"14 Oct, 10:00 AM", color:""},
    {name:"Dr. Nisha Verma", initials:"NV", specialty:"Pediatrician", exp:"8 years", rating:"4.8", next:"15 Oct, 5:00 PM", color:"teal"},
    {name:"Dr. Rohan Iyer", initials:"RI", specialty:"Orthopedics", exp:"10 years", rating:"4.7", next:"16 Oct, 11:00 AM", color:"purple"}
  ]
};

const $ = (id) => document.getElementById(id);

function showToast(message){
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function initials(name){
  return name.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase();
}

function setRole(role){
  state.role = role;
  document.querySelectorAll(".role-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.role === role));
  const roleEmail = {patient:"alex@demo.com", doctor:"doctor@demo.com", admin:"admin@demo.com"};
  $("email").value = roleEmail[role];
}

function login(){
  const roleNames = {patient:"Patient", doctor:"Doctor", admin:"Admin"};
  const names = {patient:"Alex Kumar", doctor:"Dr. Priya Patel", admin:"MediDesk Admin"};
  const shortNames = {patient:"Alex", doctor:"Priya", admin:"Admin"};
  $("loginScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  $("sideName").textContent = names[state.role];
  $("sideRole").textContent = roleNames[state.role];
  $("sideAvatar").textContent = initials(names[state.role]);
  $("topAvatar").textContent = initials(names[state.role]);
  $("topName").textContent = names[state.role];
  $("welcomeName").textContent = shortNames[state.role];
  showToast(`Signed in as ${roleNames[state.role]} · Demo mode`);
}

function logout(){
  $("appScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  showToast("Signed out safely");
}

function navigate(section){
  state.currentSection = section;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(section).classList.add("active-page");
  document.querySelectorAll(".nav-link").forEach(n => n.classList.toggle("active", n.dataset.section === section));
  window.scrollTo({top:0, behavior:"smooth"});
  $("sidebar").classList.remove("open");
}

function renderDashboardAppointments(){
  $("dashboardAppointments").innerHTML = state.appointments
    .filter(a => a.status === "upcoming")
    .map(a => `
      <div class="appointment-item">
        <div class="doctor-avatar ${a.initials === "AR" ? "teal" : ""}">${a.initials}</div>
        <div class="appointment-info"><strong>${a.doctor}</strong><small>${a.specialty} · ${a.type}</small></div>
        <div class="appointment-time"><strong>${a.date}</strong><span>${a.time}</span></div>
      </div>`).join("");
  $("upcomingCount").textContent = String(state.appointments.filter(a=>a.status==="upcoming").length).padStart(2,"0");
  $("appointmentBadge").textContent = state.appointments.filter(a=>a.status==="upcoming").length;
}

function renderAppointments(filter="all"){
  let list = state.appointments;
  if(filter !== "all") list = list.filter(a => a.status === filter);
  $("appointmentTable").innerHTML = list.map(a => `
    <div class="table-row">
      <div class="table-doctor"><div class="doctor-avatar ${a.initials==="AR"?"teal":""}">${a.initials}</div><div><strong>${a.doctor}</strong><small>${a.specialty}</small></div></div>
      <div class="table-cell"><strong>${a.date}</strong><br><small>${a.time}</small></div>
      <div class="table-cell">${a.type}</div>
      <div><span class="badge ${a.status}">${a.status === "upcoming" ? "Upcoming" : "Completed"}</span></div>
      <div><button class="row-action" onclick="${a.status==="upcoming" ? `cancelAppointment(${a.id})` : `showToast('Demo appointment details opened')`}">${a.status==="upcoming"?"Cancel":"View"}</button></div>
    </div>`).join("");
}

function renderDoctors(){
  $("doctorGrid").innerHTML = state.doctors.map(d => `
    <article class="doctor-card">
      <div class="doctor-card-top">
        <div class="doctor-avatar ${d.color}">${d.initials}</div>
        <div><h3>${d.name}</h3><div class="specialty">${d.specialty}</div></div>
      </div>
      <div class="rating">★★★★★ <span style="color:#7e899c"> ${d.rating}</span></div>
      <div class="doctor-card-info">
        <div><span>Experience</span><strong>${d.exp}</strong></div>
        <div><span>Next available</span><strong>${d.next}</strong></div>
      </div>
      <button class="primary-btn" onclick="openModalForDoctor('${d.name}')">Book with doctor →</button>
    </article>`).join("");
}

function openModal(){
  $("bookingModal").classList.remove("hidden");
  const today = new Date();
  today.setDate(today.getDate()+1);
  $("dateSelect").min = today.toISOString().split("T")[0];
  $("dateSelect").value = today.toISOString().split("T")[0];
}
function openModalForDoctor(name){
  openModal();
  $("doctorSelect").value = name;
}
function closeModal(){ $("bookingModal").classList.add("hidden"); }

function cancelAppointment(id){
  const item = state.appointments.find(a => a.id === id);
  if(!item) return;
  item.status = "completed";
  renderAppointments(document.querySelector(".filter.active")?.dataset.filter || "all");
  renderDashboardAppointments();
  showToast("Appointment cancelled in demo mode");
}

function sendMessage(){
  const input = $("messageInput");
  if(!input.value.trim()) return;
  showToast("Secure demo message sent");
  input.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".role-tab").forEach(btn => btn.addEventListener("click", () => setRole(btn.dataset.role)));
  $("showPassword").addEventListener("click", () => {
    const p = $("password");
    p.type = p.type === "password" ? "text" : "password";
    $("showPassword").textContent = p.type === "password" ? "Show" : "Hide";
  });

  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    login();
  });

  $("logoutBtn").addEventListener("click", logout);
  $("mobileMenu").addEventListener("click", () => $("sidebar").classList.add("open"));
  $("closeSidebar").addEventListener("click", () => $("sidebar").classList.remove("open"));
  $("sidebarOverlay").addEventListener("click", () => $("sidebar").classList.remove("open"));

  document.querySelectorAll(".nav-link").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.section)));
  document.querySelectorAll("[data-section-target]").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.sectionTarget)));
  document.querySelectorAll("[data-action='book']").forEach(btn => btn.addEventListener("click", openModal));

  $("bookHeroBtn").addEventListener("click", openModal);
  $("bookAppointmentBtn").addEventListener("click", openModal);
  $("closeModal").addEventListener("click", closeModal);
  $("bookingModal").addEventListener("click", e => { if(e.target === $("bookingModal")) closeModal(); });

  $("bookingForm").addEventListener("submit", e => {
    e.preventDefault();
    const doctor = $("doctorSelect").value;
    const dateObj = new Date($("dateSelect").value + "T00:00:00");
    const date = dateObj.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    const time = $("timeSelect").value;
    const type = $("visitType").value;
    const doc = state.doctors.find(d => d.name === doctor);
    state.appointments.unshift({id:Date.now(),doctor,initials:doc?.initials || initials(doctor),specialty:doc?.specialty || "Clinic visit",date,time,type,status:"upcoming"});
    renderDashboardAppointments();
    renderAppointments();
    closeModal();
    navigate("appointments");
    showToast("Appointment booked successfully in demo mode");
  });

  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderAppointments(btn.dataset.filter);
  }));

  $("notificationBtn").addEventListener("click", () => showToast("2 appointment notifications · 1 privacy notification"));

  $("globalSearch").addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    if(!q) return;
    const matches = state.appointments.filter(a => `${a.doctor} ${a.specialty} ${a.type}`.toLowerCase().includes(q));
    if(state.currentSection === "appointments") renderAppointments("all");
    if(q.length > 2) showToast(matches.length ? `${matches.length} matching appointment${matches.length>1?"s":""} found` : "No matching demo records found");
  });

  const doctorSelect = $("doctorSelect");
  doctorSelect.innerHTML = state.doctors.map(d => `<option>${d.name}</option>`).join("");

  renderDashboardAppointments();
  renderAppointments();
  renderDoctors();
});
