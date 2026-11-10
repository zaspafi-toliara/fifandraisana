/* ==========================================================
   ZA SPaFI Toliara – members' area (mpikambana.html)
   Uses the helpers exposed by app.js as window.ZA.
   Without API_URL it runs in test mode with data/sample-member.json
   (login: ZA-001 / PIN 1234).
   ========================================================== */
(function () {
  "use strict";

  const TOKEN_KEY = "za_token";
  let token = readToken();
  let data = null;          // dashboard data from the API
  let fullFinance = null;   // full transaction list (loaded on demand)
  let tab = "me";
  let taskFilter = "mine";
  let confirmTask = null;   // id of the task waiting for confirmation
  let busy = false;
  let message = "";         // error message on the login form
  let lastIdent = "";       // keeps the typed phone/ID when the form is redrawn

  function readToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function saveToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }

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
    if (!demoData) demoData = JSON.parse(await window.ZA.fetchText("data/sample-member.json", "member"));
    switch (b.action) {
      case "login":
        return (b.identifier.trim().toUpperCase() === "ZA-001" && b.pin === "1234") ? { ok: true, token: "demo" } : { ok: false, error: "bad_credentials" };
      case "me": return b.token === "demo" ? demoData : { ok: false, error: "session_expired" };
      case "finance_all": return { ok: true, finance: Object.assign({}, demoData.finance, { recent: demoData.finance_all }) };
      case "task_done": {
        const t = demoData.tasks.find(x => x.id === b.task_id);
        if (t) { t.status = "done"; t.done_date = new Date().toISOString().slice(0, 10); }
        return { ok: true };
      }
      default: return { ok: true };
    }
  }

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
  }
  function logout(msg) {
    if (token && msg === undefined) api("logout").catch(() => {});
    token = null; data = null; fullFinance = null; saveToken(null);
    message = msg || ""; render();
  }
  async function markDone(id) {
    busy = true; render();
    try {
      const r = await api("task_done", { task_id: id });
      if (r.ok) await loadMe();
      else if (r.error === "session_expired") return logout("m.session_expired");
    } catch (e) { /* keep the list as is */ }
    confirmTask = null; busy = false; render();
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

  /* ---------- rendering ---------- */
  function render() {
    const root = document.getElementById("members-app");
    if (!root || !window.ZA) return;
    const { t } = window.ZA;
    if (!token || !data) {
      root.innerHTML = loginHTML();
      const f = root.querySelector("form");
      f.addEventListener("submit", e => {
        e.preventDefault();
        login(f.identifier.value, f.pin.value);
      });
      return;
    }
    const tabs = [["me", "m.tab_me"], ["tasks", "m.tab_tasks"], ["finance", "m.tab_finance"], ["ranking", "m.tab_ranking"]];
    if (data.member.is_office) tabs.push(["fees_all", "m.tab_fees_all"]);
    if (!tabs.some(x => x[0] === tab)) tab = "me";
    root.innerHTML = `
      ${data.sample ? `<p class="demo-note">${t("m.demo_hint")}</p>` : ""}
      <div class="member-head card">
        <div>
          <h2>${t("m.hello", { name: window.ZA.esc(data.member.name) })}</h2>
          <div class="member-meta">
            <span class="chip chip--small">${window.ZA.esc(data.member.id)}</span>
            ${data.member.commission ? `<span>${t("m.commission")}: <strong>${window.ZA.esc(data.member.commission)}</strong></span>` : ""}
            ${data.member.office_role ? `<span>${t("m.role")}: <strong>${window.ZA.esc(data.member.office_role)}</strong></span>` : ""}
          </div>
        </div>
        <button class="btn btn--outline btn--small" id="logout">${t("m.logout")}</button>
      </div>
      <div class="tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button role="tab" class="tab ${k === tab ? "is-active" : ""}" aria-selected="${k === tab}" data-tab="${k}">${t(l)}</button>`).join("")}
      </div>
      <div class="tab-panel">${panelHTML()}</div>`;
    root.querySelector("#logout").addEventListener("click", () => logout());
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
    root.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => { taskFilter = b.dataset.filter; render(); }));
    root.querySelectorAll("[data-done]").forEach(b => b.addEventListener("click", () => { confirmTask = b.dataset.done; render(); }));
    root.querySelectorAll("[data-confirm]").forEach(b => b.addEventListener("click", () => markDone(b.dataset.confirm)));
    root.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", () => { confirmTask = null; render(); }));
    const all = root.querySelector("#fin-all");
    if (all) all.addEventListener("click", loadFullFinance);
  }

  function loginHTML() {
    const { t } = window.ZA;
    const demo = !(window.SITE_CONFIG || {}).API_URL;
    return `
      <div class="card login-card">
        <h2>${t("m.login_title")}</h2>
        <p class="muted">${t("m.login_intro")}</p>
        ${message ? `<div class="alert ${message === "m.session_expired" ? "alert--ok" : "alert--err"}">${t(message)}</div>` : ""}
        <form class="form" novalidate>
          <div><label for="m-id">${t("m.identifier")}</label>
            <input id="m-id" name="identifier" autocomplete="username" value="${window.ZA.esc(lastIdent)}" required></div>
          <div><label for="m-pin">${t("m.pin")}</label>
            <input id="m-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>
          <button class="btn btn--navy" type="submit" ${busy ? "disabled" : ""}>${busy ? t("common.loading") : t("m.login_btn")}</button>
        </form>
        <p class="hint">${t("m.forgot")}</p>
        ${demo ? `<p class="demo-note">${t("m.demo_hint")}</p>` : ""}
      </div>`;
  }

  function panelHTML() {
    if (tab === "me") return meHTML();
    if (tab === "tasks") return tasksHTML();
    if (tab === "finance") return financeHTML();
    if (tab === "ranking") return rankingHTML();
    if (tab === "fees_all") return feesAllHTML();
    return "";
  }

  const STATUS_KEY = { on_time: "m.fee_on_time", late: "m.fee_late", unpaid: "m.fee_unpaid", future: "m.fee_future", na: "m.fee_na" };
  function feeStatus(x) {
    if (x.paid) return x.on_time ? "on_time" : "late";
    if (x.not_member) return "na";
    return x.future ? "future" : "unpaid";
  }
  function legendHTML() {
    const { t } = window.ZA;
    return `<div class="legend">${["on_time", "late", "unpaid", "future", "na"].map(s =>
      `<span><i class="dot dot--${s}"></i>${t(STATUS_KEY[s])}</span>`).join("")}</div>`;
  }

  function meHTML() {
    const { t, esc, money, fmtDate } = window.ZA;
    const f = data.fees;
    const paid = f.months.filter(x => x.paid).length;
    const cells = f.months.map((x, i) => {
      const s = feeStatus(x);
      return `<div class="fee-cell fee-cell--${s}" title="${t(STATUS_KEY[s])}${x.date ? " · " + fmtDate(x.date) : ""}">
        <span class="fee-cell__m">${t("month_short." + (i + 1))}</span>
        <span class="fee-cell__s">${x.paid ? "✓" : s === "unpaid" ? "✕" : "·"}</span></div>`;
    }).join("");
    const loans = data.loans.length ? data.loans.map(l => `
      <li class="loan ${l.returned ? "loan--returned" : ""}">
        <div><strong>${esc(l.material_id)}</strong> · ${esc(l.type)}<div class="muted small">${esc(l.desc)}</div></div>
        <div class="loan__right">
          <span class="badge ${l.returned ? "badge--done" : "badge--in_progress"}">${t(l.returned ? "m.loan_returned" : "m.loan_out")}</span>
          <div class="muted small">${t("m.loan_since")} ${fmtDate(l.date)}${l.returned ? " → " + fmtDate(l.return_date) : ""}</div>
        </div>
      </li>`).join("") : `<li class="muted">${t("m.loans_empty")}</li>`;
    return `
      <div class="card">
        <h3>${t("m.fees_title", { year: f.year })}</h3>
        <p class="muted">${t("m.fees_summary", { paid, amount: money(f.monthly_amount) })}</p>
        <div class="fee-grid">${cells}</div>
        ${legendHTML()}
      </div>
      <div class="card mt">
        <h3>${t("m.loans_title")}</h3>
        <ul class="loans">${loans}</ul>
      </div>`;
  }

  function tasksHTML() {
    const { t, esc, fmtDate } = window.ZA;
    const today = new Date().toISOString().slice(0, 10);
    const list = data.tasks.filter(x => taskFilter === "all" || x.mine)
      .sort((a, b) => (a.status === "done") - (b.status === "done") || ((a.due || "9") < (b.due || "9") ? -1 : 1));
    const items = list.length ? list.map(x => {
      const overdue = x.status !== "done" && x.due && x.due < today;
      let action = "";
      if (x.status !== "done" && x.can_edit) {
        action = confirmTask === x.id
          ? `<div class="confirm"><span>${t("m.confirm_done")}</span>
               <button class="btn btn--gold btn--small" data-confirm="${esc(x.id)}" ${busy ? "disabled" : ""}>${t("m.confirm_yes")}</button>
               <button class="btn btn--outline btn--small" data-cancel>${t("m.confirm_no")}</button></div>`
          : `<button class="btn btn--navy btn--small" data-done="${esc(x.id)}">${t("m.task_mark_done")}</button>`;
      }
      return `
        <li class="task task--${x.status}">
          <div class="task__main">
            <div class="task__title">${esc(x.title)}
              <span class="badge badge--${x.status}">${t("goals." + x.status)}</span>
              ${overdue ? `<span class="badge badge--late">${t("m.task_overdue")}</span>` : ""}</div>
            <div class="task__meta">
              ${x.goal ? `<span>${t("m.task_goal")}: ${esc(x.goal)}</span>` : ""}
              <span>${t("m.task_assignee")}: <strong>${esc(x.assignee_label || "–")}</strong></span>
              ${x.status === "done" ? `<span>${t("m.task_done_on")} ${fmtDate(x.done_date)}</span>` : x.due ? `<span>${t("m.task_due")}: ${fmtDate(x.due)}</span>` : ""}
            </div>
          </div>
          <div class="task__action">${action}</div>
        </li>`;
    }).join("") : `<li class="muted">${t("m.tasks_empty")}</li>`;
    return `
      <div class="seg">
        <button class="${taskFilter === "mine" ? "is-active" : ""}" data-filter="mine">${t("m.tasks_mine")}</button>
        <button class="${taskFilter === "all" ? "is-active" : ""}" data-filter="all">${t("m.tasks_all")}</button>
      </div>
      <ul class="tasks">${items}</ul>`;
  }

  function financeHTML() {
    const { t, esc, money, fmtDate } = window.ZA;
    const fin = data.finance;
    const rows = (fullFinance || fin.recent).map(r => {
      const reason = r.category === "donation" ? t("m.fin_donation") : r.category === "fee" ? t("m.fin_fee") + " " + esc(r.reason.replace(/^Latsakemboka\s*/, "")) : esc(r.reason);
      return `<tr><td class="date">${fmtDate(r.date)}</td><td>${reason}</td>
        <td class="num ${r.type === "in" ? "amt-in" : "amt-out"}">${r.type === "in" ? "+" : "−"} ${money(r.amount)}</td></tr>`;
    }).join("");
    return `
      <div class="fin-stats">
        <div class="stat"><div class="stat__label">${t("m.fin_balance")}</div><div class="stat__value">${money(fin.balance)}</div></div>
        <div class="card"><div class="muted">${t("m.fin_income")}</div><div class="big amt-in">${money(fin.income)}</div>
          <div class="muted small">${t("m.fin_donations")}: ${money(fin.donations)} · ${t("m.fin_fees")}: ${money(fin.fees)}</div></div>
        <div class="card"><div class="muted">${t("m.fin_expense")}</div><div class="big amt-out">${money(fin.expense)}</div></div>
      </div>
      <div class="card mt">
        <h3>${fullFinance ? t("m.fin_all") : t("m.fin_recent")}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>${t("donors.col_date")}</th><th>${t("m.fin_reason")}</th><th class="num">${t("donors.col_amount")}</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        ${!fullFinance && fin.total_count > fin.recent.length ? `<div class="list-actions"><button class="btn btn--outline btn--small" id="fin-all" ${busy ? "disabled" : ""}>${t("common.see_all")} (${fin.total_count})</button></div>` : ""}
      </div>`;
  }

  function rankingHTML() {
    const { t, esc } = window.ZA;
    const podium = (list, unit) => list.length ? `<ol class="podium">${list.map((x, i) => `
        <li class="podium__item podium__item--${i + 1}"><span class="podium__rank">${i + 1}</span>
          <span class="podium__name">${esc(x.name)}</span><span class="podium__count">${x.count} ${t(unit)}</span></li>`).join("")}</ol>`
      : `<p class="muted">${t("m.rank_empty")}</p>`;
    return `
      <p class="muted center">${t("m.rank_year", { year: data.fees.year })}</p>
      <div class="rank-grid">
        <div class="card"><h3>${t("m.rank_fees")}</h3>${podium(data.top.fees, "m.rank_months")}</div>
        <div class="card"><h3>${t("m.rank_att")}</h3>${podium(data.top.attendance, "m.rank_times")}</div>
      </div>`;
  }

  function feesAllHTML() {
    const { t, esc } = window.ZA;
    const head = Array.from({ length: 12 }, (_, i) => `<th class="c">${t("month_short." + (i + 1))}</th>`).join("");
    const rows = (data.fees_all || []).map(r => `<tr><td class="donor"><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.id)}</div></td>
      ${r.months.map(s => `<td class="c"><i class="dot dot--${s}" title="${t(STATUS_KEY[s])}"></i></td>`).join("")}</tr>`).join("");
    return `
      <div class="card">
        <h3>${t("m.feesall_title", { year: data.fees.year })}</h3>
        <div class="table-wrap"><table class="fees-table"><thead><tr><th>${t("m.col_member")}</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        ${legendHTML()}
      </div>`;
  }

  /* ---------- start ---------- */
  window.renderMembersPage = async function () {
    if (token && !data && !busy) {
      busy = true;
      try { await loadMe(); } catch (e) { message = "m.error"; token = null; saveToken(null); }
      busy = false;
    }
    render();
  };
})();
