const API_BASE = "/api";
const state = { token: null, user: null, role: "student", complaints: [], authMode: "login" };
const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function setMessage(id, text, kind = "") {
  const el = $(id); el.textContent = text; el.className = `form-message ${kind}`.trim();
}
function toast(message) {
  const el = $("globalMessage"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}
function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);
  $("authHeading").textContent = signup ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = signup ? "Register with your email to submit and track complaints." : "Log in to view and manage your complaints.";
  $("authSubmit").textContent = signup ? "Create account" : "Log in";
  $("confirmPasswordField").classList.toggle("hidden", !signup);
  $("authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("confirmPassword").required = signup;
  setMessage("authMessage", "");
}
function showAuthenticatedApp() {
  $("authView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("sessionLabel").textContent = state.user?.email || "Signed in";
  $("roleBadge").textContent = state.role.toUpperCase();
  const admin = state.role === "admin";
  $("welcomeTitle").textContent = admin ? "Admin dashboard" : "Your dashboard";
  $("welcomeText").textContent = admin ? "Review campus reports and update their status." : "Submit a complaint and check its progress.";
  $("listHeading").textContent = admin ? "All campus complaints" : "Your complaints";
  $("listSubtitle").textContent = admin ? "Review reports from students and manage status updates." : "Review your submitted reports and their status.";
  $("submitPanel").classList.toggle("hidden", admin);
}
function showSignedOut() {
  state.token = null; state.user = null; state.role = "student"; state.complaints = [];
  $("authView").classList.remove("hidden"); $("appView").classList.add("hidden");
  $("logoutBtn").classList.add("hidden"); $("sessionLabel").textContent = "Not signed in";
}
async function loadComplaints() {
  $("complaintList").innerHTML = '<div class="loading">Loading complaints…</div>';
  try {
    const data = await api("/complaints");
    state.complaints = data.complaints || [];
    renderStats(); renderComplaints();
  } catch (error) {
    $("complaintList").innerHTML = `<div class="empty-state"><strong>Could not load complaints</strong>${escapeHTML(error.message)}<br><button class="btn-light" id="retryLoad" type="button" style="margin-top:12px;padding:9px 12px">Try again</button></div>`;
    $("retryLoad").addEventListener("click", loadComplaints);
  }
}
function renderStats() {
  const all = state.complaints;
  $("statTotal").textContent = all.length;
  $("statSubmitted").textContent = all.filter(c => c.status === "Submitted").length;
  $("statProgress").textContent = all.filter(c => c.status === "In Progress").length;
  $("statResolved").textContent = all.filter(c => c.status === "Resolved").length;
}
function statusClass(status) {
  return ({ "Submitted": "status-submitted", "In Progress": "status-in-progress", "Resolved": "status-resolved", "Rejected": "status-rejected" })[status] || "status-submitted";
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
function renderComplaints() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filter = $("statusFilter").value;
  const items = state.complaints.filter(c =>
    (!filter || c.status === filter) &&
    [c.complaint_code, c.title, c.category, c.location].some(v => String(v || "").toLowerCase().includes(query))
  );
  if (!items.length) {
    $("complaintList").innerHTML = `<div class="empty-state"><strong>${query || filter ? "No matching complaints" : "No complaints yet"}</strong>${query || filter ? "Try changing your search or status filter." : state.role === "admin" ? "New student complaints will appear here." : "Use the form to submit your first complaint."}</div>`;
    return;
  }
  $("complaintList").innerHTML = items.map(c => `
    <article class="complaint-card">
      <div class="complaint-card-head"><div><h3>${escapeHTML(c.title)}</h3><div class="complaint-id">${escapeHTML(c.complaint_code)} · ${escapeHTML(c.category)}</div></div><span class="status-pill ${statusClass(c.status)}">${escapeHTML(c.status)}</span></div>
      <p class="complaint-description">${escapeHTML(c.description)}</p>
      <div class="complaint-meta">${c.location ? `Location: ${escapeHTML(c.location)}<br>` : ""}${state.role === "admin" ? `Student: ${escapeHTML(c.student_email || "Student")}<br>` : ""}Submitted: ${escapeHTML(formatDate(c.created_at))}${c.updated_at && c.updated_at !== c.created_at ? `<br>Updated: ${escapeHTML(formatDate(c.updated_at))}` : ""}</div>
      ${state.role === "admin" ? `<div class="admin-controls"><select id="status-${escapeHTML(c.id)}" aria-label="New status for ${escapeHTML(c.complaint_code)}"><option ${c.status === "Submitted" ? "selected" : ""}>Submitted</option><option ${c.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${c.status === "Resolved" ? "selected" : ""}>Resolved</option><option ${c.status === "Rejected" ? "selected" : ""}>Rejected</option></select><button class="btn-light" type="button" data-update="${escapeHTML(c.id)}">Update status</button></div>` : ""}
    </article>`).join("");
  $("complaintList").querySelectorAll("[data-update]").forEach(button => button.addEventListener("click", () => updateComplaint(button.dataset.update)));
}
async function updateComplaint(id) {
  const select = $(`status-${id}`); if (!select) return;
  try {
    await api(`/complaints/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
    toast("Complaint status updated."); await loadComplaints();
  } catch (error) { toast(error.message); }
}
$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("signupTab").addEventListener("click", () => setAuthMode("signup"));
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); setMessage("authMessage", "");
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const signup = state.authMode === "signup";
  if (signup && password !== $("confirmPassword").value) { setMessage("authMessage", "The passwords do not match.", "error"); return; }
  $("authSubmit").disabled = true; $("authSubmit").textContent = signup ? "Creating account…" : "Logging in…";
  try {
    const result = await api(signup ? "/auth/signup" : "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (result.needsEmailConfirmation) {
      setMessage("authMessage", "Account created. Check your email to confirm it, then log in. If this is a classroom demo, email confirmation can be disabled in Supabase Auth settings.", "success");
      setAuthMode("login"); return;
    }
    state.token = result.accessToken;
    const me = await api("/auth/me");
    state.user = me.user; state.role = me.role;
    showAuthenticatedApp(); await loadComplaints();
    setMessage("authMessage", ""); toast(signup ? "Account created." : "Logged in successfully.");
  } catch (error) { setMessage("authMessage", error.message, "error"); }
  finally { $("authSubmit").disabled = false; $("authSubmit").textContent = signup ? "Create account" : "Log in"; }
});
$("logoutBtn").addEventListener("click", () => { showSignedOut(); setAuthMode("login"); toast("You have logged out."); });
$("complaintForm").addEventListener("submit", async (event) => {
  event.preventDefault(); setMessage("complaintMessage", "");
  const body = {
    title: $("complaintTitle").value.trim(),
    category: $("complaintCategory").value,
    location: $("complaintLocation").value.trim(),
    description: $("complaintDescription").value.trim()
  };
  $("complaintSubmit").disabled = true; $("complaintSubmit").textContent = "Submitting…";
  try {
    const result = await api("/complaints", { method: "POST", body: JSON.stringify(body) });
    $("complaintForm").reset(); $("descriptionCount").textContent = "0 / 2000";
    setMessage("complaintMessage", `Submitted successfully. Your tracking ID is ${result.complaint.complaint_code}.`, "success");
    toast("Complaint submitted successfully."); await loadComplaints();
  } catch (error) { setMessage("complaintMessage", error.message, "error"); }
  finally { $("complaintSubmit").disabled = false; $("complaintSubmit").innerHTML = 'Submit complaint <span aria-hidden="true">→</span>'; }
});
$("complaintDescription").addEventListener("input", () => { $("descriptionCount").textContent = `${$("complaintDescription").value.length} / 2000`; });
$("searchInput").addEventListener("input", renderComplaints);
$("statusFilter").addEventListener("change", renderComplaints);
$("refreshBtn").addEventListener("click", loadComplaints);
setAuthMode("login");
