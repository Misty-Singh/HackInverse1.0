(() => {
"use strict";

/* ====================== Core helpers ====================== */
const BRANCHES = ["CSE", "IT", "ECE"];
const S = { token: localStorage.getItem("cp_token"), user: null, view: null, authMode: "login", draft: null, quiz: null };
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const val = (f, n) => f.elements.namedItem(n).value;
const isStaff = () => S.user && (S.user.role === "teacher" || S.user.role === "admin");
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

function flash(msg, type = "") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (S.token) headers.Authorization = "Bearer " + S.token;
  let payload;
  if (form) payload = form;
  else if (body) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const r = await fetch("/api" + path, { method, headers, body: payload });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && !path.startsWith("/auth/")) { logout("Your session expired. Please log in again."); throw new Error("Session expired"); }
  if (!r.ok) throw new Error(data.error || "Request failed (" + r.status + ")");
  return data;
}

const main = (html) => { const m = $("#main"); if (m) m.innerHTML = html; };
const statCard = (num, lbl) => `<div class="stat-card"><div class="num">${esc(num)}</div><div class="lbl">${esc(lbl)}</div></div>`;
const branchOptions = (sel, withAll) => (withAll ? ["All", ...BRANCHES] : BRANCHES).map((b) => `<option ${b === sel ? "selected" : ""}>${b}</option>`).join("");

function lineChart(values) {
  if (!values.length) return `<p class="muted">No data yet — it will appear here after the first attempt.</p>`;
  const W = 400, H = 150, P = 24;
  const x = (i) => (values.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (values.length - 1));
  const y = (n) => H - P - (Math.max(0, Math.min(100, n)) / 100) * (H - 2 * P);
  const grid = [0, 50, 100].map((g) => `<line x1="${P}" x2="${W - P}" y1="${y(g)}" y2="${y(g)}" stroke="#E5E7F0"/><text x="2" y="${y(g) + 4}" font-size="10" fill="#6B7280">${g}</text>`).join("");
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const dots = values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#F96167"><title>${v}</title></circle>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${grid}${values.length > 1 ? `<polyline points="${pts}" fill="none" stroke="#2F3C7E" stroke-width="2.5"/>` : ""}${dots}</svg>`;
}

/* ====================== Auth ====================== */
function logout(msg) {
  localStorage.removeItem("cp_token");
  S.token = null; S.user = null; S.view = null;
  showAuth();
  if (msg) flash(msg, "error");
}

function showAuth() {
  const reg = S.authMode === "register";
  $("#root").innerHTML = `
  <div class="auth-wrap">
    <div class="topbar"><div class="logo-dot">C</div><div class="titles"><div class="t1">CampusPrep AI</div><div class="t2">Placement prep for GNIT</div></div></div>
    <div class="card">
      <div class="tabs">
        <button class="tab ${!reg ? "on" : ""}" data-action="authMode" data-mode="login">Log in</button>
        <button class="tab ${reg ? "on" : ""}" data-action="authMode" data-mode="register">Create account</button>
      </div>
      <form data-form="${reg ? "register" : "login"}" autocomplete="on">
        ${reg ? `<label>Full name</label><input type="text" name="name" required maxlength="80" autocomplete="name">` : ""}
        <label>Email</label><input type="text" name="email" required autocomplete="email" inputmode="email">
        <label>Password</label><input type="password" name="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? "new-password" : "current-password"}">
        ${reg ? `
          <label>I am a…</label>
          <select name="role" data-action-change="roleToggle"><option value="student">Student</option><option value="teacher">Teacher</option></select>
          <div id="branch-wrap"><label>Branch</label><select name="branch">${branchOptions("CSE")}</select></div>
          <div class="hint">Teacher accounts need admin approval before first login.</div>` : ""}
        <div id="auth-err" class="error" style="display:none"></div>
        <div style="margin-top:20px"><button class="btn btn-primary" type="submit" style="width:100%;justify-content:center">${reg ? "Create account" : "Log in"}</button></div>
      </form>
      ${!reg ? `<div class="demo-box"><b>Judges' demo logins</b> (after <code>npm run seed</code>, password <code>demo1234</code>):<br>teacher@gnit.demo · riya@gnit.demo (student)<br>Admin: the email/password from your <code>.env</code></div>` : ""}
    </div>
  </div>`;
}

const authError = (msg) => { const e = $("#auth-err"); if (e) { e.textContent = msg; e.style.display = "block"; } };

const defaultView = () => ({ student: "dashboard", teacher: "students", admin: "overview" }[S.user.role]);
const NAV = {
  student: [["dashboard", "My Progress"], ["interview", "Mock Interview"], ["quizzes", "Quizzes"], ["materials", "Study Material"]],
  teacher: [["students", "Students"], ["quizzes", "Quizzes"], ["materials", "Materials"], ["bank", "Question Bank"]],
  admin: [["overview", "Overview"], ["users", "Users"], ["students", "Students"], ["quizzes", "Quizzes"], ["materials", "Materials"], ["bank", "Question Bank"]],
};

function startApp() {
  $("#root").innerHTML = `
  <div class="hdr"><div class="hdr-in">
    <div class="brand"><div class="logo-dot">C</div>CampusPrep AI</div><div class="sp"></div>
    <div class="who">${esc(S.user.name)} · <span class="badge">${esc(S.user.role)}</span></div>
    <button class="btn" data-action="logout">Log out</button>
  </div></div>
  <div class="nav"><div class="nav-in" id="nav"></div></div>
  <div class="main" id="main"></div>`;
  go(defaultView());
}

function go(view, params) {
  if (IV.cam) { IV.cam.getTracks().forEach((t) => t.stop()); IV.cam = null; }
  if (IV.recording) ivAbort();
  S.view = view; S.params = params || {};
  const parent = { takeQuiz: "quizzes", quizResult: "quizzes", builder: "quizzes", quizStats: "quizzes", studentDetail: "students" };
  const top = parent[view] || view;
  $("#nav").innerHTML = NAV[S.user.role].map(([k, label]) => `<button class="${k === top ? "on" : ""}" data-action="nav" data-view="${k}">${label}</button>`).join("");
  main(`<p class="muted">Loading…</p>`);
  Promise.resolve(views[view](S.params)).catch((e) => { if (e.message !== "Session expired") main(`<div class="card"><h3>Something went wrong</h3><p class="muted">${esc(e.message)}</p></div>`); });
}

/* ====================== Views ====================== */
const views = {};

/* ---- Progress ---- */
function progressHtml(d) {
  const s = d.summary;
  const quizRows = d.attempts.length
    ? `<div class="scroll-x"><table class="t"><tr><th>Quiz</th><th>Score</th><th>Date</th></tr>${[...d.attempts].reverse().map((a) => `<tr><td>${esc(a.quizTitle)}</td><td><b>${a.score}/${a.total}</b> (${a.pct}%)</td><td>${fmtDate(a.submittedAt)}</td></tr>`).join("")}</table></div>`
    : `<p class="muted">No quiz attempts yet.</p>`;
  const ivRows = d.interviews.length
    ? `<div class="scroll-x"><table class="t"><tr><th>Date</th><th>Role</th><th>Confidence</th><th>Fillers</th><th>Pace</th></tr>${[...d.interviews].reverse().map((i) => `<tr><td>${fmtDate(i.createdAt)}</td><td>${esc(i.role || "—")}</td><td><b>${i.avgConfidence}</b>/100</td><td>${i.totalFillers}</td><td>${i.avgWpm || "—"} wpm</td></tr>`).join("")}</table></div>`
    : `<p class="muted">No mock interviews yet.</p>`;
  return `
  <div class="stats">
    ${statCard(s.attempts, "Quiz attempts")}${statCard(s.avgQuiz == null ? "—" : s.avgQuiz + "%", "Avg quiz score")}
    ${statCard(s.interviews, "Mock interviews")}${statCard(s.avgConfidence == null ? "—" : s.avgConfidence, "Avg confidence")}
  </div>
  <div class="grid2">
    <div class="card"><h3>Quiz scores over time (%)</h3>${lineChart(d.attempts.map((a) => a.pct))}</div>
    <div class="card"><h3>Interview confidence over time</h3>${lineChart(d.interviews.map((i) => i.avgConfidence))}</div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Quiz history</h3>${quizRows}</div>
  <div class="card"><h3>Mock interview history</h3>${ivRows}</div>
  <p class="hint">Last active: ${s.lastActive ? fmtDate(s.lastActive) : "—"}</p>`;
}

views.dashboard = async () => {
  const d = await api("/progress/me");
  main(`<div class="page-head"><div><h2>My progress</h2><p class="muted">Hi ${esc(S.user.name)} — here's how your prep is going.</p></div></div>${progressHtml(d)}`);
};

views.students = async () => {
  const { students } = await api("/progress/students");
  const rows = students.length
    ? `<div class="scroll-x"><table class="t"><tr><th>Student</th><th>Branch</th><th>Quizzes</th><th>Avg quiz</th><th>Interviews</th><th>Avg confidence</th><th>Last active</th></tr>
      ${students.map((s) => `<tr class="click" data-action="viewStudent" data-id="${esc(s.id)}"><td><b>${esc(s.name)}</b><div class="hint" style="margin:0">${esc(s.email)}</div></td><td>${esc(s.branch)}</td><td>${s.attempts}</td><td>${s.avgQuiz == null ? "—" : s.avgQuiz + "%"}</td><td>${s.interviews}</td><td>${s.avgConfidence == null ? "—" : s.avgConfidence}</td><td>${s.lastActive ? fmtDate(s.lastActive) : "—"}</td></tr>`).join("")}</table></div>`
    : `<div class="empty-state">No students have signed up yet.</div>`;
  main(`<div class="page-head"><div><h2>Student progress</h2><p class="muted">Click a student to see their full history.</p></div></div><div class="card">${rows}</div>`);
};

views.studentDetail = async ({ id }) => {
  const d = await api("/progress/students/" + id);
  main(`<div class="page-head"><div><h2>${esc(d.student.name)}</h2><p class="muted">${esc(d.student.email)} · ${esc(d.student.branch)}</p></div><button class="btn btn-ghost sm" data-action="nav" data-view="students">← All students</button></div>${progressHtml(d)}`);
};

/* ---- Quizzes ---- */
views.quizzes = async () => {
  const { quizzes } = await api("/quizzes");
  if (isStaff()) {
    const list = quizzes.length ? quizzes.map((q) => `
      <div class="item"><div>
        <h3>${esc(q.title)} <span class="badge ${q.published ? "green" : "amber"}">${q.published ? "Published" : "Draft"}</span></h3>
        <div class="muted">${q.questionCount} questions · ${esc(q.branch)} · ${q.attemptCount} attempts${q.avgPct != null ? " · avg " + q.avgPct + "%" : ""}</div>
      </div><div class="row">
        <button class="btn btn-ghost sm" data-action="quizStats" data-id="${esc(q.id)}">Results</button>
        <button class="btn btn-ghost sm" data-action="editQuiz" data-id="${esc(q.id)}">Edit</button>
        <button class="btn btn-secondary sm" data-action="togglePublish" data-id="${esc(q.id)}" data-pub="${q.published ? "0" : "1"}">${q.published ? "Unpublish" : "Publish"}</button>
        <button class="btn danger sm" data-action="deleteQuiz" data-id="${esc(q.id)}">Delete</button>
      </div></div>`).join("") : `<div class="empty-state">No quizzes yet. Create your first one.</div>`;
    main(`<div class="page-head"><div><h2>Quizzes</h2><p class="muted">Build multiple-choice quizzes. Students only see published ones.</p></div><button class="btn btn-primary" data-action="newQuiz">+ New quiz</button></div><div class="card">${list}</div>`);
  } else {
    const list = quizzes.length ? quizzes.map((q) => `
      <div class="item"><div>
        <h3>${esc(q.title)}</h3><div class="muted">${esc(q.description || "")}</div>
        <div class="hint">${q.questionCount} questions · ${q.attempts ? `Attempted ${q.attempts}× · best ${q.best}%` : "Not attempted yet"}</div>
      </div><button class="btn btn-primary sm" data-action="takeQuiz" data-id="${esc(q.id)}">${q.attempts ? "Retake" : "Start"}</button></div>`).join("")
      : `<div class="empty-state">No quizzes available yet. Your teachers will publish them here.</div>`;
    main(`<div class="page-head"><div><h2>Quizzes</h2><p class="muted">Quizzes set by your teachers.</p></div></div><div class="card">${list}</div>`);
  }
};

views.takeQuiz = async ({ id }) => {
  const { quiz } = await api("/quizzes/" + id);
  S.quiz = quiz;
  main(`
  <div class="page-head"><div><h2>${esc(quiz.title)}</h2><p class="muted">${esc(quiz.description || "")}</p></div></div>
  <form data-form="submitQuiz">
    ${quiz.questions.map((q, i) => `<div class="card"><div class="qcounter">Question ${i + 1} of ${quiz.questions.length}</div><div class="qtext" style="font-size:17px">${esc(q.text)}</div>
      ${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>`).join("")}
    <button class="btn btn-primary" type="submit">Submit answers</button>
    <button class="btn btn-ghost" type="button" data-action="nav" data-view="quizzes">Cancel</button>
  </form>`);
};

views.quizResult = async ({ result, title }) => {
  main(`
  <div class="card dark" style="text-align:center"><span class="pill">Result</span><h2>${esc(title)}</h2>
    <div class="bigscore">${result.score}/${result.total}</div><div class="muted" style="color:#CFD6F0">${result.pct}% correct</div>
    <div style="margin-top:16px"><button class="btn btn-primary" data-action="nav" data-view="quizzes">Back to quizzes</button></div></div>
  ${result.review.map((r, i) => `<div class="card"><div class="qcounter">Question ${i + 1} · ${r.correct ? "✓ Correct" : "✗ Incorrect"}</div><div class="qtext" style="font-size:17px">${esc(r.text)}</div>
    ${r.options.map((o, j) => `<div class="opt ${j === r.correctAnswer ? "right" : j === r.yourAnswer ? "wrong" : ""}"><span>${esc(o)}${j === r.correctAnswer ? " ✓" : j === r.yourAnswer ? " (your answer)" : ""}</span></div>`).join("")}</div>`).join("")}`);
};

views.quizStats = async ({ id }) => {
  const d = await api("/quizzes/" + id + "/results");
  const rows = d.results.length
    ? `<div class="scroll-x"><table class="t"><tr><th>Student</th><th>Score</th><th>Date</th></tr>${d.results.map((r) => `<tr><td><b>${esc(r.studentName)}</b><div class="hint" style="margin:0">${esc(r.studentEmail)}</div></td><td>${r.score}/${r.total} (${r.pct}%)</td><td>${fmtDate(r.submittedAt)}</td></tr>`).join("")}</table></div>`
    : `<div class="empty-state">No attempts yet.</div>`;
  main(`<div class="page-head"><div><h2>${esc(d.quiz.title)}</h2><p class="muted">Results</p></div><button class="btn btn-ghost sm" data-action="nav" data-view="quizzes">← Back</button></div><div class="card">${rows}</div>`);
};

/* ---- Quiz builder ---- */
const blankQ = () => ({ text: "", options: ["", "", "", ""], correct: 0 });
views.builder = async ({ id }) => {
  if (id) {
    const { quiz } = await api("/quizzes/" + id);
    S.draft = { id: quiz.id, title: quiz.title, description: quiz.description, branch: quiz.branch, published: quiz.published, questions: quiz.questions.map((q) => ({ text: q.text, options: [...q.options, "", "", "", ""].slice(0, Math.max(4, q.options.length)), correct: q.correct })) };
  } else if (!S.draft || S.draft.id) {
    S.draft = { title: "", description: "", branch: "All", published: false, questions: [blankQ()] };
  }
  renderBuilder();
};

function renderBuilder() {
  const d = S.draft;
  main(`
  <div class="page-head"><h2>${d.id ? "Edit quiz" : "New quiz"}</h2><button class="btn btn-ghost sm" data-action="nav" data-view="quizzes">← Cancel</button></div>
  <form data-form="saveQuiz">
    <div class="card">
      <label style="margin-top:0">Title</label><input type="text" data-bind="title" value="${esc(d.title)}" maxlength="120" placeholder="e.g. DSA Basics — Week 3">
      <label>Description (optional)</label><input type="text" data-bind="description" value="${esc(d.description)}" maxlength="500">
      <div class="row" style="margin-top:6px"><div style="flex:1;min-width:140px"><label>For branch</label><select data-bind="branch">${branchOptions(d.branch, true)}</select></div>
      <label class="row" style="margin-top:26px"><input type="checkbox" data-bind="published" ${d.published ? "checked" : ""}> Publish now (visible to students)</label></div>
    </div>
    ${d.questions.map((q, i) => `
    <div class="qblock"><div class="row" style="justify-content:space-between"><b>Question ${i + 1}</b>${d.questions.length > 1 ? `<button type="button" class="btn danger sm" data-action="removeQ" data-i="${i}">Remove</button>` : ""}</div>
      <label>Question text</label><textarea data-bind="q:${i}:text" style="min-height:60px">${esc(q.text)}</textarea>
      <label>Options — select the correct one</label>
      ${q.options.map((o, j) => `<div class="optrow"><input type="radio" name="correct${i}" data-bind="q:${i}:correct:${j}" ${q.correct === j ? "checked" : ""}><input type="text" data-bind="q:${i}:o:${j}" value="${esc(o)}" placeholder="Option ${j + 1}" maxlength="200"></div>`).join("")}
    </div>`).join("")}
    <div class="row"><button type="button" class="btn btn-secondary" data-action="addQ">+ Add question</button><button type="submit" class="btn btn-primary">Save quiz</button></div>
  </form>`);
}

function bindDraft(e) {
  const t = e.target, b = t.dataset && t.dataset.bind;
  if (!b || !S.draft) return;
  const p = b.split(":");
  if (p[0] === "q") {
    const q = S.draft.questions[+p[1]];
    if (p[2] === "text") q.text = t.value;
    else if (p[2] === "o") q.options[+p[3]] = t.value;
    else if (p[2] === "correct" && t.checked) q.correct = +p[3];
  } else S.draft[b] = t.type === "checkbox" ? t.checked : t.value;
}

/* ---- Materials ---- */
views.materials = async () => {
  const { materials } = await api("/materials");
  const form = isStaff() ? `
  <div class="card"><h3>Share new material</h3>
    <form data-form="uploadMaterial">
      <label>Title</label><input type="text" name="title" required maxlength="120">
      <label>Description (optional)</label><input type="text" name="description" maxlength="500">
      <div class="row"><div style="flex:1;min-width:140px"><label>For branch</label><select name="branch">${branchOptions("All", true)}</select></div></div>
      <label>Upload a file (PDF, Office, text, image, zip — max 10 MB)</label><input type="file" name="file">
      <label>…or paste a link</label><input type="text" name="linkUrl" placeholder="https://">
      <div style="margin-top:16px"><button class="btn btn-primary" type="submit">Share with students</button></div>
    </form></div>` : "";
  const list = materials.length ? materials.map((m) => `
    <div class="item"><div>
      <h3>${esc(m.title)} <span class="badge">${esc(m.branch)}</span></h3><div class="muted">${esc(m.description || "")}</div>
      <div class="hint">${m.type === "file" ? `📄 ${esc(m.filename)} · ${fmtSize(m.size)}` : "🔗 Link"} · by ${esc(m.authorName)} · ${fmtDate(m.createdAt)}</div>
    </div><div class="row">
      ${m.type === "link" ? `<a class="btn btn-secondary sm" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Open link</a>` : `<button class="btn btn-secondary sm" data-action="download" data-id="${esc(m.id)}" data-name="${esc(m.filename)}">Download</button>`}
      ${isStaff() && (S.user.role === "admin" || m.createdBy === S.user.id) ? `<button class="btn danger sm" data-action="deleteMaterial" data-id="${esc(m.id)}">Delete</button>` : ""}
    </div></div>`).join("") : `<div class="empty-state">No study material has been shared yet.</div>`;
  main(`<div class="page-head"><div><h2>Study material</h2><p class="muted">${isStaff() ? "Upload notes or share links for your students." : "Notes and links shared by your teachers."}</p></div></div>${form}<div class="card">${list}</div>`);
};

/* ---- Question bank ---- */
views.bank = async () => {
  const { questions } = await api("/bank");
  main(`
  <div class="page-head"><div><h2>Interview question bank</h2><p class="muted">Add real GNIT placement questions. The AI mock interview uses these first — this is what makes it specific to your college.</p></div></div>
  <div class="card"><form data-form="addBank"><label style="margin-top:0">Question</label><textarea name="text" required style="min-height:70px" maxlength="500" placeholder="e.g. Explain how you'd design a URL shortener."></textarea>
    <div class="row" style="margin-top:10px"><select name="branch" style="width:auto">${branchOptions("All", true)}</select><button class="btn btn-primary" type="submit">Add question</button></div></form></div>
  <div class="card">${questions.length ? questions.map((q) => `<div class="item"><div><b>${esc(q.text)}</b><div class="hint"><span class="badge">${esc(q.branch)}</span> by ${esc(q.authorName)}</div></div>${S.user.role === "admin" || q.createdBy === S.user.id ? `<button class="btn danger sm" data-action="deleteBank" data-id="${esc(q.id)}">Delete</button>` : ""}</div>`).join("") : `<div class="empty-state">No questions yet.</div>`}</div>`);
};

/* ---- Admin ---- */
views.overview = async () => {
  const s = await api("/admin/stats");
  main(`<div class="page-head"><div><h2>Platform overview</h2></div></div>
  <div class="stats">${statCard(s.students, "Students")}${statCard(s.teachers, "Teachers")}${statCard(s.pendingTeachers, "Teachers awaiting approval")}${statCard(s.quizzes, "Quizzes")}${statCard(s.attempts, "Quiz attempts")}${statCard(s.materials, "Study materials")}${statCard(s.interviews, "Mock interviews")}</div>
  ${s.pendingTeachers ? `<div class="card"><b>${s.pendingTeachers} teacher account(s) need approval.</b> <button class="btn btn-primary sm" data-action="nav" data-view="users" style="margin-left:10px">Review</button></div>` : ""}`);
};

views.users = async () => {
  const { users } = await api("/admin/users");
  const order = { pending: 0, active: 1, disabled: 2 };
  users.sort((a, b) => order[a.status] - order[b.status]);
  main(`<div class="page-head"><div><h2>Users</h2><p class="muted">Approve teachers, change roles, disable or remove accounts.</p></div></div>
  <div class="card"><div class="scroll-x"><table class="t"><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr>
  ${users.map((u) => { const me = u.id === S.user.id; return `<tr><td><b>${esc(u.name)}</b>${me ? " (you)" : ""}<div class="hint" style="margin:0">${esc(u.email)}${u.branch ? " · " + esc(u.branch) : ""}</div></td>
    <td>${me ? esc(u.role) : `<select data-change="userRole" data-id="${esc(u.id)}" style="width:auto">${["student", "teacher", "admin"].map((r) => `<option ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}</select>`}</td>
    <td><span class="badge ${u.status === "active" ? "green" : u.status === "pending" ? "amber" : "red"}">${esc(u.status)}</span></td>
    <td>${me ? "" : `<div class="row">${u.status === "pending" ? `<button class="btn btn-primary sm" data-action="setStatus" data-id="${esc(u.id)}" data-status="active">Approve</button>` : u.status === "active" ? `<button class="btn btn-ghost sm" data-action="setStatus" data-id="${esc(u.id)}" data-status="disabled">Disable</button>` : `<button class="btn btn-ghost sm" data-action="setStatus" data-id="${esc(u.id)}" data-status="active">Enable</button>`}<button class="btn danger sm" data-action="deleteUser" data-id="${esc(u.id)}" data-name="${esc(u.name)}">Delete</button></div>`}</td></tr>`; }).join("")}
  </table></div></div>`);
};

/* ====================== Mock interview (speech + AI scoring) ====================== */
const IV = { screen: "setup", branch: "CSE", role: "Software Engineer", questions: [], i: 0, results: [], rec: null, recording: false, live: "", start: null, cam: null, busy: false, micErr: null, camErr: null };
const FILLERS = ["um", "umm", "uh", "uhh", "like", "matlab", "actually", "basically", "you know", "toh"];
const countFillers = (t) => FILLERS.reduce((n, f) => n + ((t.toLowerCase().match(new RegExp("\\b" + f.replace(/\s+/g, "\\s+") + "\\b", "g")) || []).length), 0);
const wordCount = (t) => (t.trim().match(/\S+/g) || []).length;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

views.interview = async () => { IV.screen = "setup"; IV.branch = S.user.branch || "CSE"; ivRender(); };

function ivRender() {
  if (S.view !== "interview") return;
  if (IV.screen === "setup") main(`<div class="card"><span class="pill">Mock interview</span><h2>Set up your round</h2>
    <p class="muted">Questions come from your teachers' GNIT question bank first, then AI fills in the rest. Speak in English or Hinglish.</p>
    <label>Branch</label><select id="iv-branch">${branchOptions(IV.branch)}</select>
    <label>Target role</label><input type="text" id="iv-role" value="${esc(IV.role)}" maxlength="80">
    <div style="margin-top:22px"><button class="btn btn-primary" data-action="ivStart">Start mock interview →</button></div>
    <div class="warn">Mic answers need Chrome. No mic? You can always type your answer.</div></div>`);
  else if (IV.screen === "loading") main(`<div class="card" style="text-align:center;padding:60px 20px"><span class="pill">Preparing</span><h2>Building your question set…</h2></div>`);
  else if (IV.screen === "run") {
    const q = IV.questions[IV.i];
    main(`<div class="card"><div class="qcounter">Question ${IV.i + 1} of ${IV.questions.length}</div><div class="qtext">${esc(q)}</div>
      ${SR ? `<div class="rec-row">${IV.recording ? `<button class="btn btn-primary" data-action="ivStop"><span class="dot-live"></span>&nbsp;Stop &amp; evaluate</button>` : `<button class="btn btn-secondary" data-action="ivRecord" ${IV.busy ? "disabled" : ""}>🎤 Start answering</button>`}
        <span class="muted">English or Hinglish both work.</span></div>
        <label>Live transcript</label><div id="live-box" class="transcript-box ${IV.live ? "" : "empty"}">${esc(IV.live) || "Your speech will appear here…"}</div>
        ${!IV.recording && IV.live ? `<button class="btn btn-primary sm" data-action="ivSubmit" ${IV.busy ? "disabled" : ""}>Submit this answer →</button>` : ""}` : `<div class="warn">Speech recognition isn't supported in this browser — type your answer below.</div>`}
      ${IV.micErr ? `<div class="error">⚠ ${esc(IV.micErr)}</div>` : ""}
      <label>${SR ? "Or type your answer" : "Your answer"}</label><textarea id="manual" placeholder="Type here…"></textarea>
      <div style="margin-top:12px"><button class="btn btn-ghost" data-action="ivSubmitTyped" ${IV.busy ? "disabled" : ""}>${IV.busy ? "Scoring…" : "Submit typed answer →"}</button></div></div>
      <div class="card"><label style="margin-top:0">Optional camera preview</label><p class="muted" style="margin-top:0">Eye-contact tracking is a planned upgrade; for now this just shows your framing.</p>
        ${IV.cam ? `<video id="cam" autoplay muted playsinline></video>` : `<button class="btn btn-ghost sm" data-action="ivCamera">Enable camera</button>`}${IV.camErr ? `<div class="error">⚠ ${esc(IV.camErr)}</div>` : ""}</div>`);
    const v = $("#cam"); if (v && IV.cam) v.srcObject = IV.cam;
  } else if (IV.screen === "summary") {
    const r = IV.results, avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / (a.length || 1));
    const wpms = r.map((x) => x.wpm).filter((w) => w > 0);
    main(`<div class="card dark"><span class="pill">Session complete</span><h2>Your feedback report</h2>
      <div class="summary-grid"><div class="stat"><div class="num">${avg(r.map((x) => x.confidence))}</div><div class="lbl">Avg confidence</div></div><div class="stat"><div class="num">${r.reduce((s, x) => s + x.fillerCount, 0)}</div><div class="lbl">Filler words</div></div><div class="stat"><div class="num">${wpms.length ? avg(wpms) : "—"}</div><div class="lbl">Avg pace (wpm)</div></div></div>
      <p style="color:#CFD6F0;font-size:13px">Saved to your progress.</p>
      <button class="btn btn-primary" data-action="ivAgain">Practice again →</button></div>
      ${r.map((x, i) => `<div class="card"><div class="qcounter">Question ${i + 1}</div><div style="font-weight:bold;margin-bottom:12px">${esc(x.question)}</div>
        <div class="metric-row"><span class="metric-label">Filler words</span><span class="metric-value v-coral">${x.fillerCount}</span></div>
        <div class="metric-row"><span class="metric-label">Pacing</span><span class="metric-value v-gold">${x.wpm > 0 ? x.wpm + " wpm" : "—"}</span></div>
        <div class="metric-row"><span class="metric-label">Content score</span><span class="metric-value v-navy">${x.contentScore} / 100</span></div>
        <div class="metric-row"><span class="metric-label">Confidence score</span><span class="metric-value v-coral">${x.confidence} / 100</span></div>
        <div class="quote">${esc(x.feedback)} ${esc(x.suggestion)}</div></div>`).join("")}`);
  }
}

function ivAbort() { IV.recording = false; try { IV.rec && IV.rec.abort(); } catch (e) { /* ignore */ } }

function ivRecord() {
  IV.live = ""; IV.micErr = null;
  if (!window.isSecureContext) { IV.micErr = "The microphone needs HTTPS or localhost. Open the app at http://localhost:3000 or deploy it behind HTTPS."; return ivRender(); }
  if (!SR) { IV.micErr = "This browser has no speech recognition. Use Chrome, or type your answer."; return ivRender(); }
  const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = "en-IN";
  let finalText = "", got = false;
  rec.onresult = (e) => {
    got = true; let interim = "";
    for (let k = e.resultIndex; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) finalText += t + " "; else interim += t; }
    IV.live = (finalText + " " + interim).trim();
    const box = $("#live-box"); if (box) { box.textContent = IV.live; box.classList.remove("empty"); }
  };
  rec.onerror = (e) => {
    IV.recording = false;
    IV.micErr = e.error === "not-allowed" ? "Microphone permission was denied. Click the padlock in the address bar, allow the mic, and try again."
      : e.error === "no-speech" ? "No speech detected. Check your microphone input and try again."
      : e.error === "network" ? "Speech recognition needs an internet connection."
      : `Speech recognition error (${e.error}). Try again or type your answer.`;
    ivRender();
  };
  rec.onend = () => { if (IV.recording) { IV.recording = false; if (!got) IV.micErr = "No audio was picked up. Check your microphone."; ivRender(); } };
  IV.rec = rec; IV.start = Date.now(); IV.recording = true;
  try { rec.start(); } catch (err) { IV.recording = false; IV.micErr = "Couldn't start the microphone: " + err.message; }
  ivRender();
}

function ivStop() {
  if (!IV.recording) return;
  IV.recording = false;
  let done = false; const go = () => { if (!done) { done = true; ivSubmit(); } };
  IV.rec.onend = go; // wait for the last chunk of speech to be delivered
  try { IV.rec.stop(); } catch (e) { go(); }
  setTimeout(go, 1500);
  ivRender();
}

async function ivSubmit(typed) {
  const transcript = (typed != null ? typed : IV.live).trim();
  if (!transcript) { IV.micErr = "Say or type an answer first."; return ivRender(); }
  const question = IV.questions[IV.i];
  const secs = IV.start && typed == null ? (Date.now() - IV.start) / 1000 : 0;
  const wpm = secs > 3 ? Math.round((wordCount(transcript) / secs) * 60) : 0;
  const fillerCount = countFillers(transcript);
  IV.busy = true; IV.micErr = null; ivRender();
  let ev;
  try { ev = await api("/evaluate", { method: "POST", body: { question, transcript } }); }
  catch (e) { IV.busy = false; flash(e.message, "error"); return ivRender(); }
  const confidence = Math.max(0, Math.min(100, Math.round(ev.content_score - Math.min(25, fillerCount * 4) + (wpm > 80 && wpm < 170 ? 5 : wpm ? -5 : 0))));
  IV.results.push({ question, fillerCount, wpm, contentScore: ev.content_score, confidence, feedback: ev.feedback, suggestion: ev.suggestion });
  IV.busy = false; IV.live = ""; IV.start = null;
  if (IV.i < IV.questions.length - 1) { IV.i++; IV.screen = "run"; }
  else {
    IV.screen = "summary";
    api("/interviews", { method: "POST", body: { branch: IV.branch, role: IV.role, results: IV.results } }).catch(() => flash("Couldn't save this session to your progress", "error"));
  }
  ivRender();
}

async function ivCamera() {
  IV.camErr = null;
  if (!window.isSecureContext || !navigator.mediaDevices) { IV.camErr = "Camera needs HTTPS or localhost."; return ivRender(); }
  try { IV.cam = await navigator.mediaDevices.getUserMedia({ video: true }); }
  catch (e) { IV.camErr = e.name === "NotAllowedError" ? "Camera permission was denied. Allow it in the address bar and retry." : e.name === "NotFoundError" ? "No camera found." : "Couldn't open the camera: " + e.message; }
  ivRender();
}

/* ====================== Event handling ====================== */
const actions = {
  authMode: (el) => { S.authMode = el.dataset.mode; showAuth(); },
  logout: () => logout(),
  nav: (el) => go(el.dataset.view),
  viewStudent: (el) => go("studentDetail", { id: el.dataset.id }),

  takeQuiz: (el) => go("takeQuiz", { id: el.dataset.id }),
  newQuiz: () => { S.draft = null; go("builder", {}); },
  editQuiz: (el) => go("builder", { id: el.dataset.id }),
  quizStats: (el) => go("quizStats", { id: el.dataset.id }),
  addQ: () => { S.draft.questions.push(blankQ()); renderBuilder(); },
  removeQ: (el) => { S.draft.questions.splice(+el.dataset.i, 1); renderBuilder(); },
  togglePublish: async (el) => { await api(`/quizzes/${el.dataset.id}/publish`, { method: "PATCH", body: { published: el.dataset.pub === "1" } }); flash(el.dataset.pub === "1" ? "Quiz published" : "Quiz unpublished"); go("quizzes"); },
  deleteQuiz: async (el) => { if (!confirm("Delete this quiz and all its results?")) return; await api("/quizzes/" + el.dataset.id, { method: "DELETE" }); flash("Quiz deleted"); go("quizzes"); },

  download: async (el) => {
    const r = await fetch("/api/materials/" + el.dataset.id + "/download", { headers: { Authorization: "Bearer " + S.token } });
    if (!r.ok) return flash("Download failed", "error");
    const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = el.dataset.name || "file";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  deleteMaterial: async (el) => { if (!confirm("Delete this material?")) return; await api("/materials/" + el.dataset.id, { method: "DELETE" }); flash("Deleted"); go("materials"); },
  deleteBank: async (el) => { await api("/bank/" + el.dataset.id, { method: "DELETE" }); go("bank"); },

  setStatus: async (el) => { await api("/admin/users/" + el.dataset.id, { method: "PATCH", body: { status: el.dataset.status } }); flash("Updated"); go("users"); },
  deleteUser: async (el) => { if (!confirm(`Permanently delete ${el.dataset.name}? Their progress data is removed too.`)) return; await api("/admin/users/" + el.dataset.id, { method: "DELETE" }); flash("User deleted"); go("users"); },

  ivStart: async () => {
    IV.branch = $("#iv-branch").value; IV.role = $("#iv-role").value.trim() || "Software Engineer";
    IV.screen = "loading"; ivRender();
    try { const d = await api("/questions", { method: "POST", body: { branch: IV.branch, role: IV.role } }); IV.questions = d.questions; IV.i = 0; IV.results = []; IV.screen = "run"; }
    catch (e) { flash(e.message, "error"); IV.screen = "setup"; }
    ivRender();
  },
  ivRecord, ivStop, ivCamera,
  ivSubmit: () => ivSubmit(),
  ivSubmitTyped: () => ivSubmit(($("#manual") || {}).value || ""),
  ivAgain: () => { IV.screen = "setup"; ivRender(); },
};

const forms = {
  login: async (f) => {
    try { const d = await api("/auth/login", { method: "POST", body: { email: val(f, "email"), password: val(f, "password") } }); S.token = d.token; localStorage.setItem("cp_token", d.token); S.user = d.user; startApp(); }
    catch (e) { authError(e.message); }
  },
  register: async (f) => {
    try {
      const d = await api("/auth/register", { method: "POST", body: { name: val(f, "name"), email: val(f, "email"), password: val(f, "password"), role: val(f, "role"), branch: val(f, "branch") } });
      if (d.pending) { S.authMode = "login"; showAuth(); return flash(d.message); }
      S.token = d.token; localStorage.setItem("cp_token", d.token); S.user = d.user; startApp();
    } catch (e) { authError(e.message); }
  },
  submitQuiz: async (f) => {
    const answers = S.quiz.questions.map((_, i) => { const c = f.querySelector(`input[name="q${i}"]:checked`); return c ? Number(c.value) : -1; });
    if (answers.includes(-1)) return flash("Answer every question first", "error");
    const result = await api(`/quizzes/${S.quiz.id}/attempt`, { method: "POST", body: { answers } });
    go("quizResult", { result, title: S.quiz.title });
  },
  saveQuiz: async () => {
    const d = S.draft;
    try {
      const body = { title: d.title, description: d.description, branch: d.branch, published: d.published, questions: d.questions };
      await api(d.id ? "/quizzes/" + d.id : "/quizzes", { method: d.id ? "PUT" : "POST", body });
      flash("Quiz saved"); S.draft = null; go("quizzes");
    } catch (e) { flash(e.message, "error"); }
  },
  uploadMaterial: async (f) => {
    const fd = new FormData(f);
    if (!fd.get("file") || !fd.get("file").size) fd.delete("file");
    await api("/materials", { method: "POST", form: fd }); flash("Shared with students"); go("materials");
  },
  addBank: async (f) => { await api("/bank", { method: "POST", body: { text: val(f, "text"), branch: val(f, "branch") } }); flash("Question added"); go("bank"); },
};

const changes = {
  userRole: async (el) => { try { await api("/admin/users/" + el.dataset.id, { method: "PATCH", body: { role: el.value } }); flash("Role updated"); } catch (e) { flash(e.message, "error"); } go("users"); },
};

// Event delegation: one listener per event type handles every button and form.
const guard = (fn) => (...a) => Promise.resolve(fn(...a)).catch((e) => { if (e.message !== "Session expired") flash(e.message, "error"); });
document.addEventListener("click", (e) => { const el = e.target.closest("[data-action]"); if (el && actions[el.dataset.action]) { if (el.tagName === "A") return; guard(actions[el.dataset.action])(el); } });
document.addEventListener("submit", (e) => { const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault(); if (forms[f.dataset.form]) guard(forms[f.dataset.form])(f); });
document.addEventListener("change", (e) => {
  bindDraft(e);
  if (e.target.dataset && e.target.dataset.change && changes[e.target.dataset.change]) guard(changes[e.target.dataset.change])(e.target);
  if (e.target.dataset && e.target.dataset.actionChange === "roleToggle") { const w = $("#branch-wrap"); if (w) w.style.display = e.target.value === "student" ? "" : "none"; }
});
document.addEventListener("input", bindDraft);

/* ====================== Boot ====================== */
(async function boot() {
  if (S.token) {
    try { const { user } = await api("/auth/me"); S.user = user; return startApp(); }
    catch (e) { localStorage.removeItem("cp_token"); S.token = null; }
  }
  showAuth();
})();
})();
