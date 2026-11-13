/* ==========================================================
   ZA SPaFi Toliara – members' area (mpikambana.html)
   Home of the logged member:
     - greeting + quick tiles
     - finances, goals, commissions (tasks per Vaomiera), rankings
     - Birao: everybody's fees and arrivals (top 5 + see more)
   The profile button opens a side panel with the personal information
   (card, fees, materials, arrivals, internal rules).
   The phone "back" button closes the panel / form instead of leaving.
   Test mode (no API_URL): data/sample-member.json, login ZA-001 / PIN 1234.
   ========================================================== */
(function () {
  "use strict";

  const TOKEN_KEY = "za_token";
  const COMM_ICON = { "Soratra Masina": "📖", "Fifandraisana": "📣", "Fitaovana": "🧰", "Fampandrosoana": "🌱", "Hira sy mozika": "🎵" };
  let token = readToken();
  let data = null;            // dashboard data from the API
  let fullFinance = null;     // full transaction list (loaded on demand)
  const openGoals = new Set();
  const expanded = new Set(); // lists shown in full ("see more")
  let confirmTask = null;
  let busy = false;
  let message = "";
  let lastIdent = "";
  let photoMsg = "";
  let notice = "";            // short confirmation after adding a task/goal
  let drawer = false;         // profile panel open
  let comm = null;            // commission shown in the Vaomiera section ("mine" = my tasks)
  let form = null;            // "task" | "goal" while a form is open
  let bc = { kind: "fivoriana" };   // announcement form values (Birao)
  let bcStep = "edit";        // "edit" | "confirm" | "sent"
  let bcPreview = null;       // { text, count } before sending
  let bcMsg = "";
  const sentTasks = {};       // task id -> "sending" | number of SMS | "error"

  function readToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function saveToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
  const Z = () => window.ZA;

  /* ---------- API (or test mode) ---------- */
  async function api(action, extra) {
    const CFG = window.SITE_CONFIG || {};
    const body = Object.assign({ action, token }, extra || {});
    if (CFG.API_URL) {
      const res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      return res.json();
    }
    return demoApi(body);
  }

  let demoData = null;
  async function demoApi(b) {
    if (!demoData) demoData = JSON.parse(await Z().fetchText("data/sample-member.json", "member"));
    switch (b.action) {
      case "login":
        return (b.identifier.trim().toUpperCase() === "ZA-001" && b.pin === "1234") ? { ok: true, token: "demo" } : { ok: false, error: "bad_credentials" };
      case "me": return b.token === "demo" ? JSON.parse(JSON.stringify(demoData)) : { ok: false, error: "session_expired" };
      case "finance_all": return { ok: true, finance: Object.assign({}, demoData.finance, { recent: demoData.finance_all }) };
      case "task_done": {
        const t = demoData.tasks.find(x => x.id === b.task_id);
        if (t) { t.status = "done"; t.done_date = new Date().toISOString().slice(0, 10); }
        demoData.goals.forEach(g => g.steps.forEach(x => { if (x.id === b.task_id) { x.status = "done"; x.done_date = new Date().toISOString().slice(0, 10); } }));
        return { ok: true };
      }
      case "add_task": {
        const id = "N" + Date.now();
        const p = demoData.people.find(x => x.id === b.assignee);
        const g = demoData.goals.find(x => x.id === b.goal_id);
        const task = { id, goal: g ? g.title : "", goal_id: b.goal_id, title: b.title, assignee: b.assignee || b.commission,
          assignee_label: p ? p.name : b.commission, due: b.due || "", status: "todo", done_date: "", mine: true, can_edit: true,
          visible: b.visible !== false, commission: b.commission };
        demoData.tasks.push(task); if (g) g.steps.push(task);
        return { ok: true, id };
      }
      case "add_goal":
        demoData.goals.push({ id: "T" + Date.now(), title: b.title, description: b.description || "", target_date: b.due || "", visible: b.visible !== false, steps: [] });
        return { ok: true };
      case "my_photo": return { ok: true, photo: "" };
      case "broadcast": {
        const title = b.kind === "hamonjy" ? "Hamonjy antsam-panahy" : b.kind === "hafa" ? b.other : "Fivoriana";
        if (!b.place || !b.time || !b.date || !title) return { ok: false, error: "missing_fields" };
        let text = "ZA SPaFi: " + title + ". Andro: " + b.date + ". Ora: " + b.time + ". Toerana: " + b.place + ".";
        if (b.kind === "hamonjy") text += (b.male ? " Fanamiana lahy: " + b.male + "." : "") + (b.female ? " Fanamiana vavy: " + b.female + "." : "");
        text += " Tongava ara-potoana. Misaotra!";
        return b.preview ? { ok: true, text, count: demoData.people.length } : { ok: true, sent: demoData.people.length, text };
      }
      case "notify_task": return { ok: true, sent: 1 };
      default: return { ok: true };
    }
  }

  /* ---------- phone back button: close the panel / form first ---------- */
  function pushNav(state) { try { history.pushState(Object.assign({ za: true }, state), ""); } catch (e) { /* ignore */ } }
  window.addEventListener("popstate", () => {
    if (drawer) { drawer = false; render(); return; }
    if (form) { form = null; render(); }
  });
  function openDrawer() { drawer = true; pushNav({ drawer: true }); render(); }
  function closeDrawer() { if (drawer) history.back(); }
  function openForm(kind) { form = kind; notice = ""; pushNav({ form: kind }); render(); }
  function closeForm() { if (form) history.back(); }

  /* ---------- actions ---------- */
  async function login(identifier, pin) {
    lastIdent = identifier;
    busy = true; message = ""; render();
    try {
      const r = await api("login", { identifier, pin });
      if (r.ok) { token = r.token; saveToken(token); await loadMe(); }
      else message = r.error === "locked" ? "m.locked" : "m.login_error";
    } catch (e) { message = "m.error"; }
    busy = false; render();
  }
  async function loadMe() {
    const r = await api("me");
    if (!r.ok) { logout(r.error === "session_expired" ? "m.session_expired" : "m.error"); return; }
    data = r; fullFinance = null;
    if (!comm) comm = data.member.commission && (data.commissions || []).includes(data.member.commission) ? data.member.commission : "mine";
  }
  function logout(msg) {
    if (token && msg === undefined) api("logout").catch(() => {});
    token = null; data = null; fullFinance = null; saveToken(null); drawer = false; form = null;
    message = msg || ""; render();
  }
  async function markDone(id) {
    busy = true; render();
    try {
      const r = await api("task_done", { task_id: id });
      if (r.ok) await loadMe();
      else if (r.error === "session_expired") return logout("m.session_expired");
    } catch (e) { /* keep the list */ }
    confirmTask = null; busy = false; render();
  }
  async function changePhoto(file) {
    photoMsg = "";
    if (!navigator.onLine) { photoMsg = "m.photo_online"; render(); return; }
    busy = true; render();
    try {
      const image = await window.ZACard.processPhoto(file);
      const r = await api("my_photo", { image });
      if (r.ok) { data.member.photo = r.photo || ""; data.member.photo_data = image; photoMsg = "m.photo_saved"; }
      else if (r.error === "session_expired") return logout("m.session_expired");
      else photoMsg = "m.error";
    } catch (e) { photoMsg = "m.error"; }
    busy = false; render();
  }
  async function loadFullFinance() {
    busy = true; render();
    try {
      const r = await api("finance_all");
      if (r.ok) fullFinance = r.finance.recent;
      else if (r.error === "session_expired") return logout("m.session_expired");
    } catch (e) { /* ignore */ }
    busy = false; render();
  }
  async function submitForm(kind, f) {
    const v = n => (f.elements[n] ? f.elements[n].value.trim() : "");
    const payload = kind === "task"
      ? { commission: v("commission"), goal_id: v("goal"), title: v("title"), assignee: v("assignee"), due: v("due"), visible: f.elements.visible.checked }
      : { title: v("title"), description: v("description"), due: v("due"), visible: f.elements.visible.checked };
    if (!payload.title || (kind === "task" && !payload.goal_id)) { notice = "err.missing_fields"; render(); return; }
    busy = true; render();
    try {
      const r = await api(kind === "task" ? "add_task" : "add_goal", payload);
      if (r.ok) { await loadMe(); notice = kind === "task" ? "m.task_added" : "m.goal_added"; form = null; history.back(); }
      else if (r.error === "session_expired") return logout("m.session_expired");
      else notice = "err." + r.error;
    } catch (e) { notice = "m.error"; }
    busy = false; render();
  }

  /* ---------- rendering ---------- */
  function render() {
    const root = document.getElementById("members-app");
    if (!root || !Z()) return;
    if (!token || !data) {
      root.innerHTML = loginHTML();
      const f = root.querySelector("form");
      f.addEventListener("submit", e => { e.preventDefault(); login(f.identifier.value, f.pin.value); });
      return;
    }
    const { t } = Z();
    const sections = [["m-finance", "m.tab_finance"], ["m-goals", "m.goals_title"], ["m-comm", "about.commissions_title"], ["m-ranking", "m.tab_ranking"]];
    const canBc = (data.member.can || {}).broadcast;
    if (canBc) sections.unshift(["m-notify", "n.title"]);
    if (data.member.is_office) sections.push(["m-feesall", "m.tab_fees_all"], ["m-attall", "e.attendance"]);
    root.innerHTML = `
      ${data.sample ? `<p class="demo-note">${t("m.demo_hint")}</p>` : ""}
      ${heroHTML()}
      ${tilesHTML()}
      <nav class="m-nav">${sections.map(([id, k]) => `<a href="#${id}">${t(k)}</a>`).join("")}</nav>
      ${canBc ? `<section id="m-notify" class="m-sec">${secHead("📢", "n.title")}${notifyHTML()}</section>` : ""}
      <section id="m-finance" class="m-sec">${secHead("💰", "m.tab_finance")}${financeHTML()}</section>
      <section id="m-goals" class="m-sec">${secHead("🎯", "m.goals_title")}<p class="muted">${t("m.goals_intro")}</p>${goalFormBlock()}${goalsHTML()}</section>
      <section id="m-comm" class="m-sec">${secHead("🤝", "about.commissions_title")}<p class="muted">${t("m.vaomiera_intro")}</p>${commHTML()}</section>
      <section id="m-ranking" class="m-sec">${secHead("🏆", "m.tab_ranking")}${rankingHTML()}</section>
      ${data.member.is_office ? `
        <section id="m-feesall" class="m-sec">${feesAllHTML()}</section>
        <section id="m-attall" class="m-sec">${attendanceAllHTML()}</section>` : ""}
      <div class="drawer-backdrop ${drawer ? "is-open" : ""}" data-close-drawer></div>
      <aside class="drawer ${drawer ? "is-open" : ""}" aria-hidden="${!drawer}">
        <div class="drawer__head"><strong>${t("m.tab_me")}</strong><button class="drawer__close" data-close-drawer aria-label="${t("m.close")}">✕</button></div>
        <div class="drawer__body">${profileHTML()}</div>
      </aside>`;
    bind(root);
  }

  function secHead(icon, key) { return `<div class="sec-head"><span class="sec-ico">${icon}</span><h2>${Z().t(key)}</h2></div>`; }

  function avatarHTML(cls) {
    const m = data.member;
    if (window.ZACard) return window.ZACard.photoHTML({ id: m.id, name: m.name, photo: m.photo, photo_data: m.photo_data }, cls);
    return `<div class="${cls}"><span>${Z().esc(m.name.slice(0, 1))}</span></div>`;
  }

  function heroHTML() {
    const { t, esc, fmtDate } = Z();
    const m = data.member, can = m.can || {};
    const d = new Date(); const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return `
      <div class="dash-hero">
        <div class="dash-hero__text">
          <div class="dash-hero__date">${fmtDate(iso)}</div>
          <h2>${t("m.hello", { name: esc(m.name) })}</h2>
          <div class="dash-hero__chips">
            <span>${esc(m.id)}</span>
            ${m.commission ? `<span>${COMM_ICON[m.commission] || ""} ${esc(m.commission)}</span>` : ""}
            ${m.office_role ? `<span>${esc(m.office_role)}</span>` : ""}
          </div>
          ${can.tx || can.fees || can.confirm || can.materials || can.attendance || can.cards
            ? `<a class="btn btn--gold btn--small mt-s" href="fampidirana.html">${t("nav.entry")} →</a>` : ""}
        </div>
        <button class="dash-avatar" data-open-drawer aria-label="${t("m.tab_me")}">
          ${avatarHTML("dash-avatar__img")}
          <span>${t("m.tab_me")}</span>
        </button>
      </div>`;
  }

  function tilesHTML() {
    const { t, money } = Z();
    const f = data.fees, a = data.attendance || {};
    const paid = f.months.filter(x => x.paid).length;
    const due = f.months.filter(x => !x.future && !x.not_member).length;
    const open = (data.tasks || []).filter(x => x.mine && x.status !== "done").length;
    return `
      <div class="tiles">
        <a class="tile tile--navy" href="#m-finance"><span class="tile__label">${t("m.fin_balance")}</span><strong>${money(data.finance.balance)}</strong></a>
        <button class="tile" data-open-drawer><span class="tile__label">${t("m.tile_fees")}</span><strong>${paid}/${due || f.months.length}</strong><span class="tile__sub">${Z().esc(f.year)}</span></button>
        <a class="tile" href="#m-comm" data-comm-jump="mine"><span class="tile__label">${t("m.tile_tasks")}</span><strong>${open}</strong></a>
        <button class="tile" data-open-drawer><span class="tile__label">${t("m.att_mine")}</span><strong>${a.meetings ? a.present + "/" + a.meetings : "–"}</strong>
          ${a.meetings ? `<span class="tile__sub">${t("m.att_late")}: ${a.late}</span>` : ""}</button>
      </div>`;
  }

  function loginHTML() {
    const { t } = Z();
    const demo = !(window.SITE_CONFIG || {}).API_URL;
    return `
      <div class="card login-card">
        <div class="login-card__logo"><img src="assets/img/logo-192.png" alt=""></div>
        <h2>${t("m.login_title")}</h2>
        <p class="muted">${t("m.login_intro")}</p>
        ${message ? `<div class="alert ${message === "m.session_expired" ? "alert--ok" : "alert--err"}">${t(message)}</div>` : ""}
        <form class="form" novalidate>
          <div><label for="m-id">${t("m.identifier")}</label>
            <input id="m-id" name="identifier" autocomplete="username" value="${Z().esc(lastIdent)}" required></div>
          <div><label for="m-pin">${t("m.pin")}</label>
            <input id="m-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>
          <button class="btn btn--navy" type="submit" ${busy ? "disabled" : ""}>${busy ? t("common.loading") : t("m.login_btn")}</button>
        </form>
        <p class="hint">${t("m.forgot")}</p>
        ${demo ? `<p class="demo-note">${t("m.demo_hint")}</p>` : ""}
      </div>`;
  }

  /* ---------- profile panel ---------- */
  const STATUS_KEY = { on_time: "m.fee_on_time", late: "m.fee_late", unpaid: "m.fee_unpaid", future: "m.fee_future", na: "m.fee_na" };
  function feeStatus(x) {
    if (x.paid) return x.on_time ? "on_time" : "late";
    if (x.not_member) return "na";
    return x.future ? "future" : "unpaid";
  }
  function legendHTML() {
    const { t } = Z();
    return `<div class="legend">${["on_time", "late", "unpaid", "future", "na"].map(s =>
      `<span><i class="dot dot--${s}"></i>${t(STATUS_KEY[s])}</span>`).join("")}</div>`;
  }

  function profileHTML() {
    const { t, esc, money, fmtDate } = Z();
    const m = data.member, f = data.fees;
    const paid = f.months.filter(x => x.paid).length;
    const cells = f.months.map(x => {
      const s = feeStatus(x);
      return `<div class="fee-cell fee-cell--${s}" title="${t(STATUS_KEY[s])}${x.date ? " · " + fmtDate(x.date) : ""}">
        <span class="fee-cell__m">${t("month_short." + Number(x.month.slice(5)))}</span>
        <span class="fee-cell__s">${x.paid ? "✓" : s === "unpaid" ? "✕" : "·"}</span></div>`;
    }).join("");
    const loans = data.loans.length ? data.loans.map(l => `
      <li class="loan ${l.returned ? "loan--returned" : ""}">
        <div><strong>${esc(l.material_id)}</strong> · ${esc(l.type)}<div class="muted small">${esc(l.desc)}</div></div>
        <div class="loan__right">
          <span class="badge ${l.returned ? "badge--done" : "badge--in_progress"}">${t(l.returned ? "m.loan_returned" : "m.loan_out")}</span>
          <div class="muted small">${fmtDate(l.date)}${l.returned ? " → " + fmtDate(l.return_date) : ""}</div>
        </div>
      </li>`).join("") : `<li class="muted">${t("m.loans_empty")}</li>`;
    const docs = (window.SITE_CONFIG || {}).DOCS || {};
    return `
      ${window.ZACard ? `<div class="card my-card">
        <h3>${t("m.my_card")}</h3>
        ${window.ZACard.card({ id: m.id, name: m.name, commission: m.commission, role: m.office_role, photo: m.photo, photo_data: m.photo_data })}
        <div class="center mt-s">
          <label class="btn btn--outline btn--small file-btn">📷 ${t("e.photo_camera")}<input type="file" accept="image/*" capture="user" class="my-photo" hidden></label>
          <label class="btn btn--outline btn--small file-btn">🖼 ${t("e.photo_gallery")}<input type="file" accept="image/*" class="my-photo" hidden></label>
          <p class="hint">${t("m.my_card_hint")}</p>
          ${photoMsg ? `<div class="alert ${photoMsg === "m.photo_saved" ? "alert--ok" : "alert--err"}">${t(photoMsg)}</div>` : ""}
        </div>
      </div>` : ""}
      <div class="card">
        <h3>${t("m.fees_title", { year: f.year })}</h3>
        <p class="muted small">${t("m.fees_summary", { paid, amount: money(f.monthly_amount) })}</p>
        <div class="fee-grid">${cells}</div>
        ${legendHTML()}
      </div>
      ${myAttendanceHTML()}
      <div class="card">
        <h3>${t("m.loans_title")}</h3>
        <ul class="loans">${loans}</ul>
      </div>
      ${docs.rules ? `<div class="card">
        <h3>${t("m.rules_title")}</h3>
        <p class="muted small">${t("m.rules_text")}</p>
        <a class="btn btn--navy btn--small" href="${esc(docs.rules)}" target="_blank" rel="noopener">${t("about.rules_btn")}</a>
      </div>` : ""}
      <button class="btn btn--outline e-wide" id="logout">${t("m.logout")}</button>`;
  }

  function myAttendanceHTML() {
    const { t, esc, fmtDate } = Z();
    const a = data.attendance;
    if (!a) return "";
    const pct = a.meetings ? Math.round(a.present / a.meetings * 100) : 0;
    return `
      <div class="card">
        <h3>${t("m.att_mine")}</h3>
        ${a.meetings ? `
          <p><strong>${t("m.att_meetings", { present: a.present, n: a.meetings })}</strong> · ${pct}%</p>
          <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
          <div class="att-stats">
            <span class="badge badge--done">${t("m.att_on_time")}: ${a.on_time}</span>
            <span class="badge badge--late">${t("m.att_late")}: ${a.late}</span>
            ${a.avg_time ? `<span class="badge badge--todo">${t("m.att_avg")}: ${esc(a.avg_time)}</span>` : ""}
          </div>
          ${a.last.length ? `<ul class="att-last">${a.last.map(x =>
            `<li><span>${fmtDate(x.date)}</span><strong class="${x.late ? "amt-out" : x.late === false ? "amt-in" : ""}">${esc(x.time || "–")}</strong></li>`).join("")}</ul>` : ""}
          <p class="hint">${t("m.att_start", { time: esc(data.meeting.start), tol: data.meeting.tolerance })}</p>`
        : `<p class="muted">${t("m.att_none")}</p>`}
      </div>`;
  }

  /* ---------- finances ---------- */
  function financeHTML() {
    const { t, esc, money, fmtDate } = Z();
    const fin = data.finance;
    const list = fullFinance || fin.recent.slice(0, 5);
    const rows = list.map(r => {
      const reason = r.category === "donation" ? t("m.fin_donation") : r.category === "fee" ? t("m.fin_fee") + " " + esc(r.reason.replace(/^Latsakemboka\s*/, "")) : esc(r.reason);
      return `<li class="tx tx--${r.type}">
        <span class="tx__ico">${r.type === "in" ? "↓" : "↑"}</span>
        <span class="tx__main"><strong>${reason}</strong><span class="muted small">${fmtDate(r.date)}</span></span>
        <span class="tx__amt">${r.type === "in" ? "+" : "−"} ${money(r.amount)}</span></li>`;
    }).join("");
    return `
      <div class="fin-stats">
        <div class="stat"><div class="stat__label">${t("m.fin_balance")}</div><div class="stat__value">${money(fin.balance)}</div></div>
        <div class="card stat-card"><div class="muted">${t("m.fin_income")}</div><div class="big amt-in">${money(fin.income)}</div>
          <div class="muted small">${t("m.fin_donations")}: ${money(fin.donations)} · ${t("m.fin_fees")}: ${money(fin.fees)}</div></div>
        <div class="card stat-card"><div class="muted">${t("m.fin_expense")}</div><div class="big amt-out">${money(fin.expense)}</div></div>
      </div>
      <div class="card mt">
        <h3>${fullFinance ? t("m.fin_all") : t("m.fin_recent")}</h3>
        <ul class="txs">${rows}</ul>
        ${!fullFinance && fin.total_count > list.length
          ? `<div class="list-actions"><button class="btn btn--outline btn--small" id="fin-all" ${busy ? "disabled" : ""}>${t("m.see_more", { n: fin.total_count })}</button></div>`
          : fullFinance ? `<div class="list-actions"><button class="btn btn--outline btn--small" id="fin-less">${t("common.show_less")}</button></div>` : ""}
      </div>`;
  }

  /* ---------- goals ---------- */
  function goalFormBlock() {
    const { t } = Z();
    if (!(data.member.can || {}).tasks_admin) return "";
    if (form !== "goal") return `<button class="btn btn--gold btn--small mb" data-form="goal">＋ ${t("m.add_goal")}</button>${noticeHTML("m.goal_added")}`;
    return `
      <form class="card form add-form" id="f-goal">
        <h3>${t("m.add_goal")}</h3>
        <div><label>${t("m.f_goal_title")}</label><input name="title" required maxlength="200"></div>
        <div><label>${t("m.f_desc")}</label><textarea name="description" rows="2" maxlength="500"></textarea></div>
        <div class="row">
          <div><label>${t("m.task_due")}</label><input name="due" type="date"></div>
          <label class="choice"><input type="checkbox" name="visible" checked> ${t("m.f_public")}</label>
        </div>
        ${notice ? `<div class="alert alert--err">${Z().t(notice)}</div>` : ""}
        <div class="inline"><button class="btn btn--gold" type="submit" ${busy ? "disabled" : ""}>${t("e.save")}</button>
          <button class="btn btn--outline" type="button" data-cancel-form>${t("m.confirm_no")}</button></div>
      </form>`;
  }
  function noticeHTML(key) {
    return notice === key ? `<div class="alert alert--ok mt-s">${Z().t(notice)}</div>` : "";
  }

  function stepHTML(x) {
    const { t, esc, fmtDate } = Z();
    return `
      <li class="step step--${esc(x.status)}">
        <div class="step__title">${esc(x.title)}<span class="badge badge--${esc(x.status)}">${t("goals." + x.status)}</span>
          ${x.visible === false ? `<span class="badge badge--hidden">${t("m.hidden")}</span>` : ""}</div>
        <div class="step__info">${x.commission ? (COMM_ICON[x.commission] || "") + " " : ""}${esc(x.assignee_label || "–")} · ${x.status === "done" ? t("m.task_done_on") + " " + fmtDate(x.done_date || x.due) : (x.due ? t("m.task_due") + ": " + fmtDate(x.due) : "")}</div>
        ${x.status !== "done" && (x.can_edit || data.member.is_office) ? `<div class="mt-xs inline">${x.can_edit ? doneButton(x) : ""}${data.member.is_office ? notifyTaskButton(x) : ""}</div>` : ""}
      </li>`;
  }

  function goalsHTML() {
    const { t, esc, fmtDate } = Z();
    const complete = g => g.steps.length > 0 && g.steps.every(x => x.status === "done");
    const goals = (data.goals || []).filter(g => !complete(g));
    const done = (data.goals || []).filter(complete);
    const doneHTML = done.length ? `
      <div class="card done-goals mt">
        <h3>✅ ${t("m.done_goals")}</h3>
        <ul class="done-list">${done.map(g => {
          const last = g.steps.map(x => x.done_date || x.due).filter(Boolean).sort().pop();
          return `<li><span class="done-list__name">${esc(g.title)}${g.visible ? "" : ` <span class="badge badge--hidden">${t("m.hidden")}</span>`}</span>
            <span class="muted small">${t("goals.steps_count", { n: g.steps.length })}${last ? " · " + t("goals.completed_on") + " " + fmtDate(last) : ""}</span></li>`;
        }).join("")}</ul>
      </div>` : "";
    if (!goals.length) return `<p class="muted">${t("goals.empty")}</p>` + doneHTML;
    return `<div class="goals goals--members">${goals.map(g => {
      const total = g.steps.length;
      const done = g.steps.filter(x => x.status === "done").length;
      const pct = total ? Math.round(done / total * 100) : 0;
      const open = openGoals.has(g.id);
      return `
        <article class="goal ${g.visible ? "" : "goal--hidden"} ${total && done === total ? "goal--done" : ""}">
          <h3>${esc(g.title)} ${g.visible ? "" : `<span class="badge badge--hidden">${t("m.hidden")}</span>`}</h3>
          ${g.description ? `<p class="goal__desc">${esc(g.description)}</p>` : ""}
          <div class="goal__meta"><strong>${t("goals.progress", { done, total })}</strong>
            ${g.target_date ? `<span>${t("goals.target")}: ${fmtDate(g.target_date)}</span>` : ""}</div>
          <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
          ${total ? `<button class="btn btn--outline btn--small goal__toggle" data-goal="${esc(g.id)}" aria-expanded="${open}">${t(open ? "goals.hide_steps" : "goals.show_steps")}</button>` : ""}
          ${open ? `<ol class="steps">${g.steps.map(stepHTML).join("")}</ol>` : ""}
        </article>`;
    }).join("")}</div>` + doneHTML;
  }

  function notifyTaskButton(x) {
    const { t, esc } = Z();
    const st = sentTasks[x.id];
    if (st === "sending") return `<button class="btn btn--outline btn--small" disabled>${t("n.sending")}</button>`;
    if (typeof st === "number") return `<span class="badge badge--done">✓ ${t("n.sent", { n: st })}</span>`;
    return `<button class="btn btn--outline btn--small" data-notify-task="${esc(x.id)}">📩 ${t("n.task_btn")}</button>${st === "error" ? ` <span class="badge badge--late">${t("n.error")}</span>` : ""}`;
  }

  /* Announcement to every member by SMS (Birao, Mpandrindra) */
  function notifyHTML() {
    const { t, esc } = Z();
    if (bcStep === "sent") return `
      <div class="card notify">
        <div class="alert alert--ok">✓ ${t("n.done", { n: bcPreview ? bcPreview.count : "" })}</div>
        <p class="sms-preview">${esc(bcPreview ? bcPreview.text : "")}</p>
        <button class="btn btn--outline btn--small" data-bc="new">${t("n.new")}</button>
      </div>`;
    if (bcStep === "confirm" && bcPreview) return `
      <div class="card notify">
        <h3>${t("n.confirm_title")}</h3>
        <p class="sms-preview">${esc(bcPreview.text)}</p>
        <p class="muted small">${t("n.stats", { n: bcPreview.count, c: bcPreview.text.length, p: Math.ceil(bcPreview.text.length / 153) })}</p>
        ${bcMsg ? `<div class="alert alert--err">${t(bcMsg)}</div>` : ""}
        <div class="inline">
          <button class="btn btn--gold" data-bc="send" ${busy ? "disabled" : ""}>📨 ${busy ? t("n.sending") : t("n.send_all", { n: bcPreview.count })}</button>
          <button class="btn btn--outline" data-bc="edit">${t("n.edit")}</button>
        </div>
      </div>`;
    const k = bc.kind;
    return `
      <form class="card form notify" id="f-bc">
        <p class="muted small">${t("n.intro")}</p>
        <div class="seg seg--3">
          ${[["fivoriana", "n.k_meeting"], ["hamonjy", "n.k_visit"], ["hafa", "n.k_other"]].map(([v, l]) =>
            `<label><input type="radio" name="kind" value="${v}" ${k === v ? "checked" : ""}> ${t(l)}</label>`).join("")}
        </div>
        ${k === "hafa" ? `<div><label>${t("n.reason")}</label><input name="other" maxlength="80" value="${esc(bc.other || "")}" required></div>` : ""}
        ${k === "hamonjy" ? `<div class="row">
            <div><label>${t("n.male")}</label><textarea name="male" rows="2" maxlength="80">${esc(bc.male || "")}</textarea></div>
            <div><label>${t("n.female")}</label><textarea name="female" rows="2" maxlength="80">${esc(bc.female || "")}</textarea></div>
          </div>` : ""}
        <div><label>${t("n.place")}</label><input name="place" maxlength="80" value="${esc(bc.place || "")}" required></div>
        <div class="row">
          <div><label>${t("n.date")}</label><input name="date" type="date" value="${esc(bc.date || "")}" required></div>
          <div><label>${t("n.time")}</label><input name="time" type="time" value="${esc(bc.time || "")}" required></div>
        </div>
        ${bcMsg ? `<div class="alert alert--err">${t(bcMsg)}</div>` : ""}
        <button class="btn btn--gold" type="submit" ${busy ? "disabled" : ""}>📨 ${t("n.send")}</button>
      </form>`;
  }
  function readBc(f) {
    const v = n => (f.elements[n] ? f.elements[n].value.trim() : "");
    bc = { kind: (f.querySelector("input[name=kind]:checked") || {}).value || "fivoriana",
           other: v("other") || bc.other, male: v("male") || bc.male, female: v("female") || bc.female,
           place: v("place"), date: v("date"), time: v("time") };
  }
  async function bcPreviewNow() {
    bcMsg = "";
    if (!bc.place || !bc.date || !bc.time || (bc.kind === "hafa" && !bc.other)) { bcMsg = "err.missing_fields"; render(); return; }
    busy = true; render();
    try {
      const r = await api("broadcast", Object.assign({ preview: true }, bc));
      if (r.ok) { bcPreview = { text: r.text, count: r.count }; bcStep = "confirm"; }
      else if (r.error === "session_expired") return logout("m.session_expired");
      else bcMsg = "err." + r.error;
    } catch (e) { bcMsg = "m.error"; }
    busy = false; render();
  }
  async function bcSend() {
    busy = true; bcMsg = ""; render();
    try {
      const r = await api("broadcast", bc);
      if (r.ok) { bcStep = "sent"; bcPreview = { text: r.text, count: r.sent }; }
      else if (r.error === "session_expired") return logout("m.session_expired");
      else bcMsg = r.error === "sms_failed" ? "n.error" : "err." + r.error;
    } catch (e) { bcMsg = "m.error"; }
    busy = false; render();
  }
  async function notifyTask(id) {
    sentTasks[id] = "sending"; render();
    try {
      const r = await api("notify_task", { task_id: id });
      sentTasks[id] = r.ok ? r.sent : "error";
      if (!r.ok && r.error === "session_expired") return logout("m.session_expired");
    } catch (e) { sentTasks[id] = "error"; }
    render();
  }

  function doneButton(x) {
    const { t, esc } = Z();
    return confirmTask === x.id
      ? `<div class="confirm"><span>${t("m.confirm_done")}</span>
           <button class="btn btn--gold btn--small" data-confirm="${esc(x.id)}" ${busy ? "disabled" : ""}>${t("m.confirm_yes")}</button>
           <button class="btn btn--outline btn--small" data-cancel>${t("m.confirm_no")}</button></div>`
      : `<button class="btn btn--navy btn--small" data-done="${esc(x.id)}">${t("m.task_mark_done")}</button>`;
  }

  /* ---------- commissions (Vaomiera): tasks per commission ---------- */
  function commHTML() {
    const { t, esc } = Z();
    const comms = data.commissions || [];
    const tasks = data.tasks || [];
    const tabs = [["mine", "👤", t("m.tasks_mine")]].concat(comms.map(c => [c, COMM_ICON[c] || "•", c]));
    const list = comm === "mine" ? tasks.filter(x => x.mine) : tasks.filter(x => x.commission === comm);
    const openN = list.filter(x => x.status !== "done").length, doneN = list.length - openN;
    const canAdd = comm !== "mine" && (data.can_add_tasks || []).includes(comm);
    // group by goal
    const groups = {};
    list.forEach(x => { const k = x.goal_id || "_"; (groups[k] = groups[k] || []).push(x); });
    const goalTitle = id => { const g = (data.goals || []).find(x => x.id === id); return g ? g.title : t("m.no_goal"); };
    const body = list.length ? Object.keys(groups).map(k => `
      <div class="comm-group">
        <div class="comm-group__title">🎯 ${esc(goalTitle(k))}</div>
        <ol class="steps steps--flat">${groups[k].sort((a, b) => (a.status === "done") - (b.status === "done") || ((a.due || "9") < (b.due || "9") ? -1 : 1)).map(stepHTML).join("")}</ol>
      </div>`).join("") : `<p class="muted">${t(comm === "mine" ? "m.tasks_empty" : "m.no_tasks_comm")}</p>`;
    return `
      <div class="comm-tabs">${tabs.map(([k, ico, label]) =>
        `<button class="comm-tab ${k === comm ? "is-active" : ""}" data-comm="${esc(k)}"><span>${ico}</span>${esc(label)}</button>`).join("")}</div>
      <div class="card comm-panel">
        <div class="comm-panel__head">
          <div><h3>${comm === "mine" ? "👤 " + t("m.tasks_mine") : (COMM_ICON[comm] || "") + " " + esc(comm)}</h3>
            <span class="badge badge--in_progress">${t("m.comm_open", { n: openN })}</span>
            <span class="badge badge--done">${t("m.comm_done", { n: doneN })}</span></div>
          ${canAdd && form !== "task" ? `<button class="btn btn--gold btn--small" data-form="task">＋ ${t("m.add_task")}</button>` : ""}
        </div>
        ${canAdd && form === "task" ? taskFormHTML() : noticeHTML("m.task_added")}
        ${body}
      </div>`;
  }

  function taskFormHTML() {
    const { t, esc } = Z();
    const goals = data.goals || [];
    const people = (data.people || []).filter(p => p.commission === comm);
    if (!goals.length) return `<p class="alert alert--err">${t("m.no_goal_hint")}</p>`;
    return `
      <form class="form add-form" id="f-task">
        <input type="hidden" name="commission" value="${esc(comm)}">
        <div><label>${t("m.task_goal")}</label>
          <select name="goal" required><option value="">…</option>${goals.map(g => `<option value="${esc(g.id)}">${esc(g.title)}</option>`).join("")}</select></div>
        <div><label>${t("m.f_title")}</label><input name="title" required maxlength="200"></div>
        <div class="row">
          <div><label>${t("m.task_assignee")}</label>
            <select name="assignee"><option value="${esc(comm)}">${t("m.f_whole_comm")}</option>${people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>
          <div><label>${t("m.task_due")}</label><input name="due" type="date"></div>
        </div>
        <label class="choice"><input type="checkbox" name="visible" checked> ${t("m.f_public")}</label>
        ${notice && !/added$/.test(notice) ? `<div class="alert alert--err">${t(notice)}</div>` : ""}
        <div class="inline"><button class="btn btn--gold" type="submit" ${busy ? "disabled" : ""}>${t("e.save")}</button>
          <button class="btn btn--outline" type="button" data-cancel-form>${t("m.confirm_no")}</button></div>
      </form>`;
  }

  /* ---------- rankings ---------- */
  function rankingHTML() {
    const { t, esc } = Z();
    const podium = (list, unit) => list.length ? `<ol class="podium">${list.map((x, i) => `
        <li class="podium__item podium__item--${i + 1}"><span class="podium__rank">${i + 1}</span>
          <span class="podium__name">${esc(x.name)}</span><span class="podium__count">${x.count} ${t(unit)}</span></li>`).join("")}</ol>`
      : `<p class="muted">${t("m.rank_empty")}</p>`;
    return `
      <p class="muted">${t("m.rank_year", { year: esc(data.fees.year) })}</p>
      <div class="rank-grid">
        <div class="card"><h3>${t("m.rank_fees")}</h3>${podium(data.top.fees, "m.rank_months")}</div>
        <div class="card"><h3>${t("m.rank_att")}</h3>${podium(data.top.attendance, "m.rank_times")}</div>
      </div>`;
  }

  /* ---------- Birao reports (top 5 + see more) ---------- */
  function moreButton(key, total) {
    const { t } = Z();
    if (total <= 5) return "";
    return `<div class="list-actions"><button class="btn btn--outline btn--small" data-more="${key}">${expanded.has(key) ? t("common.show_less") : t("m.see_more", { n: total })}</button></div>`;
  }

  function feesAllHTML() {
    const { t, esc } = Z();
    const all = data.fees_all || [];
    const list = expanded.has("fees") ? all : all.slice(0, 5);
    const head = data.fees.months.map(x => `<th class="c">${t("month_short." + Number(x.month.slice(5)))}</th>`).join("");
    const rows = list.map(r => `<tr><td class="donor"><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.id)}</div></td>
      ${r.months.map(s => `<td class="c"><i class="dot dot--${s}" title="${t(STATUS_KEY[s])}"></i></td>`).join("")}</tr>`).join("");
    return `
      <div class="card">
        <h3>${t("m.feesall_title", { year: esc(data.fees.year) })}</h3>
        <div class="table-wrap"><table class="fees-table"><thead><tr><th>${t("m.col_member")}</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        ${moreButton("fees", all.length)}
        ${legendHTML()}
      </div>`;
  }

  function attendanceAllHTML() {
    const { t, esc } = Z();
    const all = data.attendance_all || [];
    const list = expanded.has("att") ? all : all.slice(0, 5);
    const n = all.length ? all[0].meetings : 0;
    const rows = list.map(r => {
      const pct = r.meetings ? Math.round(r.present / r.meetings * 100) : 0;
      return `<tr>
        <td class="donor"><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.id)}</div></td>
        <td class="num">${r.present}/${r.meetings}<div class="mini-bar"><i style="width:${pct}%"></i></div></td>
        <td class="num amt-in">${r.on_time}</td>
        <td class="num amt-out">${r.late}</td>
        <td class="num">${esc(r.avg_time || "–")}</td>
      </tr>`;
    }).join("");
    return `
      <div class="card">
        <h3>${t("m.att_report")} · ${esc(data.fees.year)}</h3>
        <p class="hint">${t("m.att_start", { time: esc(data.meeting.start), tol: data.meeting.tolerance })}</p>
        ${n ? `<div class="table-wrap"><table>
          <thead><tr><th>${t("m.col_member")}</th><th class="num">${t("m.att_rate")}</th><th class="num">${t("m.att_on_time")}</th>
            <th class="num">${t("m.att_late")}</th><th class="num">${t("m.att_avg")}</th></tr></thead>
          <tbody>${rows}</tbody></table></div>${moreButton("att", all.length)}` : `<p class="muted">${t("m.att_none")}</p>`}
      </div>`;
  }

  /* ---------- events ---------- */
  function bind(root) {
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
    on("[data-open-drawer]", "click", openDrawer);
    on("[data-close-drawer]", "click", closeDrawer);
    on("#logout", "click", () => { drawer = false; logout(); });
    on("[data-goal]", "click", e => { const id = e.currentTarget.dataset.goal; openGoals.has(id) ? openGoals.delete(id) : openGoals.add(id); render(); });
    on("[data-done]", "click", e => { confirmTask = e.currentTarget.dataset.done; render(); });
    on("[data-confirm]", "click", e => markDone(e.currentTarget.dataset.confirm));
    on("[data-cancel]", "click", () => { confirmTask = null; render(); });
    on(".my-photo", "change", e => changePhoto(e.currentTarget.files[0]));
    on("#fin-all", "click", loadFullFinance);
    on("#fin-less", "click", () => { fullFinance = null; render(); });
    on("[data-more]", "click", e => { const k = e.currentTarget.dataset.more; expanded.has(k) ? expanded.delete(k) : expanded.add(k); render(); });
    on("[data-comm]", "click", e => { comm = e.currentTarget.dataset.comm; if (form === "task") closeForm(); notice = ""; render(); });
    on("[data-comm-jump]", "click", e => { comm = e.currentTarget.dataset.commJump; render(); setTimeout(() => { const s = document.getElementById("m-comm"); if (s) s.scrollIntoView(); }, 0); });
    on("[data-form]", "click", e => openForm(e.currentTarget.dataset.form));
    on("[data-cancel-form]", "click", closeForm);
    on("[data-notify-task]", "click", e => notifyTask(e.currentTarget.dataset.notifyTask));
    const fbc = root.querySelector("#f-bc");
    if (fbc) {
      fbc.querySelectorAll("input[name=kind]").forEach(i => i.addEventListener("change", () => { readBc(fbc); render(); }));
      fbc.addEventListener("submit", e => { e.preventDefault(); readBc(fbc); bcPreviewNow(); });
    }
    on("[data-bc]", "click", e => {
      const a = e.currentTarget.dataset.bc;
      if (a === "send") bcSend();
      if (a === "edit") { bcStep = "edit"; render(); }
      if (a === "new") { bcStep = "edit"; bc = { kind: "fivoriana" }; bcPreview = null; render(); }
    });
    const ft = root.querySelector("#f-task"); if (ft) ft.addEventListener("submit", e => { e.preventDefault(); submitForm("task", ft); });
    const fg = root.querySelector("#f-goal"); if (fg) fg.addEventListener("submit", e => { e.preventDefault(); submitForm("goal", fg); });
    document.body.classList.toggle("no-scroll", drawer);
  }

  /* ---------- start ---------- */
  window.renderMembersPage = async function () {
    if (!window.__swReg && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
      window.__swReg = true; navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    if (token && !data && !busy) {
      busy = true;
      try { await loadMe(); } catch (e) { message = "m.error"; token = null; saveToken(null); }
      busy = false;
    }
    render();
  };
})();
