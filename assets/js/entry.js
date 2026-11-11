/* ==========================================================
   ZA SPaFi Toliara – phone entry app (fampidirana.html)
   For the treasurer, secretaries and the Fitaovana commission.
   - Login once per phone (30 days)
   - Scan member cards / material labels (QR)
   - Every entry is saved on the phone first (queue) and sent when online
   Test mode (no API_URL): data/sample-lists.json, login ZA-003 / PIN 1234
   ========================================================== */
(function () {
  "use strict";

  const K = { token: "za_dev_token", lists: "za_lists", queue: "za_queue", failed: "za_failed" };
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  let token = store.get(K.token, null);
  let lists = store.get(K.lists, null);
  let queue = store.get(K.queue, []);
  let failed = store.get(K.failed, []);
  let view = { name: "home" };
  let syncing = false;
  let flash = "";            // short confirmation message
  let loginMsg = "";
  let search = "";
  let scanner = null;        // Html5Qrcode instance
  let attendance = null;     // { session, date, ids: [] } while in attendance mode
  let newPhoto = null;       // { id, data } photo taken but not yet saved

  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
  const Z = () => window.ZA;
  const CFG = () => window.SITE_CONFIG || {};

  /* ---------- server ---------- */
  async function api(action, extra) {
    const body = Object.assign({ action, token }, extra || {});
    if (CFG().API_URL) {
      const res = await fetch(CFG().API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      return res.json();
    }
    // test mode
    if (action === "login") return (body.identifier.trim().toUpperCase() === "ZA-003" && body.pin === "1234") ? { ok: true, token: "demo" } : { ok: false, error: "bad_credentials" };
    if (action === "staff_lists") return JSON.parse(await Z().fetchText("data/sample-lists.json", "lists"));
    if (action === "sync") return { ok: true, results: body.ops.map(o => ({ op_id: o.op_id, ok: true })) };
    return { ok: true };
  }

  async function refreshLists() {
    const r = await api("staff_lists");
    if (r.ok) { r.fetched = new Date().toISOString(); lists = r; store.set(K.lists, lists); reapplyQueue(); }
    else if (r.error === "session_expired" || r.error === "forbidden") logout();
    return r.ok;
  }

  async function sync() {
    if (syncing || !queue.length || !navigator.onLine) return;
    syncing = true; renderStatus();
    try {
      const batch = queue.slice(0, 100);
      const r = await api("sync", { ops: batch.map(({ op_id, type, data }) => ({ op_id, type, data })) });
      if (r.ok) {
        const byId = {}; r.results.forEach(x => { byId[x.op_id] = x; });
        const sent = new Set();
        batch.forEach(op => {
          const res = byId[op.op_id];
          if (!res) return;
          sent.add(op.op_id);
          if (!res.ok) failed.push({ label: op.label, error: res.error, at: op.at });
        });
        queue = queue.filter(op => !sent.has(op.op_id));
        store.set(K.queue, queue); store.set(K.failed, failed);
        await refreshLists();
      } else if (r.error === "session_expired") { logout("m.session_expired"); }
    } catch (e) { /* offline or server unreachable: keep the queue */ }
    syncing = false;
    if (view.name === "home" || view.name === "donations") render(); else renderStatus();
  }

  function enqueue(type, data, label) {
    queue.push({ op_id: uid(), type, data, label, at: new Date().toISOString() });
    store.set(K.queue, queue);
    applyLocal(type, data);
    flash = Z().t("e.saved");
    sync();
  }

  /* Updates the cached lists so the screen reflects entries not yet sent */
  function applyLocal(type, d) {
    if (!lists) return;
    const mem = id => lists.members.find(m => m.id === id);
    const mat = id => lists.materials.find(m => m.id === id);
    if (type === "fee" && mem(d.member_id)) mem(d.member_id).paid = Array.from(new Set(mem(d.member_id).paid.concat(d.months)));
    if (type === "loan" && mat(d.material_id)) Object.assign(mat(d.material_id), { holder_id: d.member_id, holder_name: (mem(d.member_id) || {}).name || d.member_id, since: d.date });
    if (type === "return" && mat(d.material_id)) Object.assign(mat(d.material_id), { holder_id: "", holder_name: "", since: "" });
    if (type === "photo" && mem(d.member_id)) mem(d.member_id).photo_data = d.image;
    if (type === "donation_status" && lists.pending_donations) lists.pending_donations = lists.pending_donations.filter(x => x.key !== d.key);
    store.set(K.lists, lists);
  }
  function reapplyQueue() { queue.forEach(op => applyLocal(op.type, op.data)); }

  async function login(identifier, pin) {
    loginMsg = ""; render();
    try {
      const r = await api("login", { identifier, pin, remember: true });
      if (!r.ok) { loginMsg = r.error === "not_staff" ? "e.not_staff" : r.error === "locked" ? "m.locked" : "m.login_error"; render(); return; }
      token = r.token; store.set(K.token, token);
      await refreshLists();
      view = { name: "home" };
    } catch (e) { loginMsg = "m.error"; }
    render();
  }
  function logout(msg) {
    if (token && msg === undefined) api("logout").catch(() => {});
    token = null; lists = null; store.del(K.token); store.del(K.lists);
    loginMsg = msg || ""; render();
  }

  /* ---------- QR scanner ---------- */
  async function openScanner(onCode, continuous) {
    const box = document.getElementById("scanner");
    box.hidden = false;
    document.getElementById("scan-msg").textContent = Z().t("e.scan_hint");
    if (!window.Html5Qrcode) { document.getElementById("scan-msg").textContent = Z().t("e.camera_error"); return; }
    let last = "", lastAt = 0;
    scanner = new Html5Qrcode("reader");
    try {
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, text => {
        const code = String(text).trim().toUpperCase();
        if (code === last && Date.now() - lastAt < 2500) return;   // same card held in front of the camera
        last = code; lastAt = Date.now();
        if (navigator.vibrate) navigator.vibrate(80);
        if (!continuous) closeScanner();
        onCode(code);
      });
    } catch (e) {
      document.getElementById("scan-msg").textContent = Z().t("e.camera_error");
    }
  }
  async function closeScanner() {
    const box = document.getElementById("scanner");
    if (scanner) { try { await scanner.stop(); scanner.clear(); } catch (e) { /* already stopped */ } scanner = null; }
    if (box) box.hidden = true;
    if (attendance) render();
  }
  function handleCode(code) {
    if (!lists) return;
    if (lists.members.some(m => m.id === code)) { view = { name: "member", id: code }; }
    else if (lists.materials.some(m => m.id === code)) { view = { name: "material", id: code }; }
    else { flash = Z().t("e.unknown_code", { code }); }
    render();
  }

  /* ---------- rendering ---------- */
  function render() {
    const root = document.getElementById("entry-app");
    if (!root || !Z()) return;
    if (!token || !lists) { root.innerHTML = loginHTML(); bindLogin(root); return; }
    let body = "";
    if (view.name === "home") body = homeHTML();
    else if (view.name === "member") body = memberHTML(view.id);
    else if (view.name === "material") body = materialHTML(view.id);
    else if (view.name === "money") body = moneyHTML();
    else if (view.name === "attendance") body = attendanceHTML();
    else if (view.name === "donations") body = donationsHTML();
    root.innerHTML = `<div id="e-status-wrap">${statusHTML()}</div>` + (flash ? `<div class="alert alert--ok flash">${Z().esc(flash)}</div>` : "") + failedHTML() + body;
    flash = "";
    bindStatus(root);
    bind(root);
  }

  /* Updates only the status bar (keeps what is being typed in the forms) */
  function renderStatus() {
    const wrap = document.getElementById("e-status-wrap");
    if (!wrap || !token || !lists) { render(); return; }
    wrap.innerHTML = statusHTML();
    bindStatus(wrap);
  }
  function bindStatus(root) {
    const on = (sel, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener("click", fn));
    on("[data-act=sync]", sync);
    on("[data-act=refresh]", async () => { await refreshLists(); renderStatus(); });
    on("[data-act=logout]", () => logout());
  }

  function loginHTML() {
    const { t } = Z();
    return `
      <div class="card login-card">
        <h2>${t("e.title")}</h2>
        <p class="muted">${t("e.login_intro")}</p>
        ${loginMsg ? `<div class="alert alert--err">${t(loginMsg)}</div>` : ""}
        <form class="form" id="e-login" novalidate>
          <div><label for="e-id">${t("m.identifier")}</label><input id="e-id" name="identifier" autocomplete="username" required></div>
          <div><label for="e-pin">${t("m.pin")}</label><input id="e-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>
          <button class="btn btn--navy" type="submit">${t("m.login_btn")}</button>
        </form>
        ${!CFG().API_URL ? `<p class="demo-note">Test: ZA-003 / PIN 1234</p>` : ""}
      </div>`;
  }
  function bindLogin(root) {
    const f = root.querySelector("#e-login");
    f.addEventListener("submit", e => { e.preventDefault(); login(f.identifier.value, f.pin.value); });
  }

  function statusHTML() {
    const { t, fmtDate, esc } = Z();
    const online = navigator.onLine;
    const when = lists.fetched ? fmtDate(lists.fetched.slice(0, 10)) + " " + lists.fetched.slice(11, 16) : "";
    return `
      <div class="e-status ${online ? "" : "is-offline"}">
        <div><strong>${esc(lists.me.name)}</strong> · <span>${t(online ? "e.online" : "e.offline")}</span></div>
        <div class="e-status__row">
          <span>${queue.length ? t("e.pending", { n: queue.length }) : t("e.all_sent")}</span>
          ${queue.length && online ? `<button class="btn btn--gold btn--small" data-act="sync" ${syncing ? "disabled" : ""}>${t(syncing ? "e.syncing" : "e.sync")}</button>` : ""}
        </div>
        <div class="e-status__row small"><span>${t("e.lists_date")}: ${when}</span>
          ${online ? `<button class="linkbtn" data-act="refresh">${t("e.refresh")}</button>` : ""}
          <button class="linkbtn" data-act="logout">${t("m.logout")}</button></div>
      </div>`;
  }
  function failedHTML() {
    if (!failed.length) return "";
    const { t, esc } = Z();
    return `<div class="alert alert--err">${failed.map(f => `<div>${t("e.failed")}: ${esc(f.label)} – ${t("err." + f.error) !== "err." + f.error ? t("err." + f.error) : esc(f.error)}</div>`).join("")}
      <button class="btn btn--outline btn--small mt-s" data-act="dismiss">${t("e.dismiss")}</button></div>`;
  }

  function homeHTML() {
    const { t, esc } = Z();
    const can = lists.me.can;
    const q = search.trim().toLowerCase();
    let results = "";
    if (q.length >= 2) {
      const ms = lists.members.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)).slice(0, 8)
        .map(m => `<li><button class="pick" data-go="member" data-id="${esc(m.id)}"><strong>${esc(m.name)}</strong><span>${esc(m.id)} · ${esc(m.commission)}</span></button></li>`);
      const mt = lists.materials.filter(m => m.id.toLowerCase().includes(q) || (m.type + " " + m.desc).toLowerCase().includes(q)).slice(0, 8)
        .map(m => `<li><button class="pick" data-go="material" data-id="${esc(m.id)}"><strong>${esc(m.id)}</strong><span>${esc(m.type)} ${esc(m.size)}</span></button></li>`);
      results = `<ul class="picks">${ms.join("") + mt.join("")}</ul>`;
    }
    const n = (lists.pending_donations || []).length;
    return `
      <button class="e-big e-big--scan" data-act="scan"><span class="e-ico">▣</span>${t("e.scan")}</button>
      <div class="e-search"><input id="e-search" type="search" placeholder="${t("e.search")}" value="${esc(search)}" autocomplete="off">${results}</div>
      <div class="e-grid">
        ${can.attendance ? `<button class="e-big" data-go="attendance"><span class="e-ico">✓</span>${t("e.attendance")}</button>` : ""}
        ${can.finance ? `<button class="e-big" data-go="money"><span class="e-ico">Ar</span>${t("e.money")}</button>` : ""}
        ${can.finance ? `<button class="e-big" data-go="donations"><span class="e-ico">♥</span>${t("e.donations")}${n ? ` <span class="count">${n}</span>` : ""}</button>` : ""}
        <a class="e-big" href="karatra.html"><span class="e-ico">▤</span>${t("e.cards")}</a>
      </div>`;
  }

  function memberHTML(id) {
    const { t, esc, money, fmtDate } = Z();
    const m = lists.members.find(x => x.id === id);
    if (!m) return backHTML();
    const can = lists.me.can;
    const year = lists.year;
    let html = backHTML() + `
      <div class="card e-head"><h2>${esc(m.name)}</h2>
        <div class="member-meta"><span class="chip chip--small">${esc(m.id)}</span><span>${esc(m.commission)}</span>${m.role ? `<span>${esc(m.role)}</span>` : ""}</div></div>`;
    if (can.attendance && window.ZACard) {
      const pending = newPhoto && newPhoto.id === m.id;
      const shown = pending ? Object.assign({}, m, { photo_data: newPhoto.data }) : m;
      html += `
        <div class="card mt photo-box">
          ${window.ZACard.photoHTML(shown, "photo-prev")}
          <div>
            <h3>${t("e.photo")}</h3>
            <p class="hint">${t("e.photo_hint")}</p>
            <label class="btn btn--outline btn--small file-btn">${t("e.photo_take")}<input type="file" accept="image/*" id="photo-input" hidden></label>
            ${pending ? `<button class="btn btn--gold btn--small" data-act="photo-save">${t("e.photo_save")}</button>` : ""}
          </div>
        </div>`;
    }
    if (can.finance) {
      const chips = Array.from({ length: 12 }, (_, i) => {
        const k = year + "-" + String(i + 1).padStart(2, "0");
        const paid = m.paid.includes(k);
        return `<label class="mchip ${paid ? "is-paid" : ""}"><input type="checkbox" name="month" value="${k}" ${paid ? "disabled checked" : ""}><span>${t("month_short." + (i + 1))}</span></label>`;
      }).join("");
      html += `
        <form class="card form mt" id="f-fee">
          <h3>${t("e.fee_title", { year })}</h3>
          <p class="hint">${t("e.fee_pick")}</p>
          <div class="mchips">${chips}</div>
          <div class="row">
            <div><label>${t("e.fee_amount")}</label><input name="amount" inputmode="numeric" value="${lists.monthly_fee || ""}"></div>
            <div><label>${t("e.date")}</label><input name="date" type="date" value="${today()}"></div>
          </div>
          <p class="fee-total" id="fee-total">${t("e.fee_total", { amount: money(0) })}</p>
          <button class="btn btn--gold" type="submit">${t("e.save")}</button>
        </form>`;
    }
    if (can.attendance) {
      html += `
        <form class="card form mt" id="f-present">
          <h3>${t("e.attendance")}</h3>
          <div class="row">
            <div><label>${t("e.session")}</label><select name="session">${lists.sessions.map(s => `<option>${esc(s)}</option>`).join("")}</select></div>
            <div><label>${t("e.date")}</label><input name="date" type="date" value="${today()}"></div>
          </div>
          <button class="btn btn--navy" type="submit">${t("e.present")}</button>
        </form>`;
    }
    if (can.materials) {
      const held = lists.materials.filter(x => x.holder_id === m.id);
      const free = lists.materials.filter(x => !x.holder_id);
      html += `
        <div class="card mt">
          <h3>${t("e.holds")}</h3>
          <ul class="loans">${held.length ? held.map(x => `<li class="loan"><div><strong>${esc(x.id)}</strong> · ${esc(x.type)} ${esc(x.size)}<div class="muted small">${fmtDate(x.since)}</div></div>
            <button class="btn btn--outline btn--small" data-return="${esc(x.id)}">${t("e.return")}</button></li>`).join("") : `<li class="muted">${t("e.holds_none")}</li>`}</ul>
          <form class="form mt-s" id="f-lend">
            <label>${t("e.lend")}</label>
            <div class="inline">
              <select name="material"><option value="">${t("e.choose_material")}</option>${free.map(x => `<option value="${esc(x.id)}">${esc(x.id)} · ${esc(x.type)} ${esc(x.size)}</option>`).join("")}</select>
              <button class="btn btn--outline btn--small" type="button" data-act="scan-material">${t("e.or_scan")}</button>
            </div>
            <button class="btn btn--navy" type="submit">${t("e.save")}</button>
          </form>
        </div>`;
    }
    return html;
  }

  function materialHTML(id) {
    const { t, esc, fmtDate } = Z();
    const x = lists.materials.find(m => m.id === id);
    if (!x) return backHTML();
    const can = lists.me.can.materials;
    let html = backHTML() + `
      <div class="card e-head"><h2>${esc(x.id)} · ${esc(x.type)}</h2>
        <p class="muted">${esc(x.desc)}${x.size ? " · " + esc(x.size) : ""}</p>
        <p><span class="badge ${x.holder_id ? "badge--in_progress" : "badge--done"}">${x.holder_id ? t("e.held_by", { name: esc(x.holder_name || x.holder_id), date: fmtDate(x.since) }) : t("e.available")}</span></p>
      </div>`;
    if (!can) return html;
    if (x.holder_id) {
      html += `<button class="btn btn--gold e-wide mt" data-return="${esc(x.id)}">${t("e.return")}</button>`;
    } else {
      html += `
        <form class="card form mt" id="f-lend-to">
          <label>${t("e.lend_to")}</label>
          <div class="inline">
            <select name="member"><option value="">${t("e.choose_member")}</option>${lists.members.map(m => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.id)})</option>`).join("")}</select>
            <button class="btn btn--outline btn--small" type="button" data-act="scan-member">${t("e.or_scan")}</button>
          </div>
          <div><label>${t("e.date")}</label><input name="date" type="date" value="${today()}"></div>
          <button class="btn btn--navy" type="submit">${t("e.save")}</button>
        </form>`;
    }
    return html;
  }

  function moneyHTML() {
    const { t } = Z();
    return backHTML() + `
      <form class="card form" id="f-money">
        <h3>${t("e.money")}</h3>
        <div class="seg"><label><input type="radio" name="kind" value="in" checked> ${t("e.in")}</label><label><input type="radio" name="kind" value="out"> ${t("e.out")}</label></div>
        <div><label>${t("e.amount")}</label><input name="amount" inputmode="numeric" required></div>
        <div><label>${t("e.reason")}</label><input name="reason" required></div>
        <div class="row">
          <div><label>${t("e.category")}</label><input name="category"></div>
          <div><label>${t("e.date")}</label><input name="date" type="date" value="${today()}"></div>
        </div>
        <p class="hint">${t("e.money_note")}</p>
        <button class="btn btn--gold" type="submit">${t("e.save")}</button>
      </form>`;
  }

  function attendanceHTML() {
    const { t, esc } = Z();
    if (!attendance) attendance = { session: lists.sessions[0], date: today(), ids: [] };
    const names = attendance.ids.map(id => (lists.members.find(m => m.id === id) || { name: id }).name);
    return backHTML() + `
      <div class="card form">
        <h3>${t("e.attendance")}</h3>
        <div class="row">
          <div><label>${t("e.session")}</label><select id="att-session">${lists.sessions.map(s => `<option ${s === attendance.session ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
          <div><label>${t("e.date")}</label><input id="att-date" type="date" value="${attendance.date}"></div>
        </div>
        <button class="btn btn--navy" data-act="att-scan">▣ ${t("e.att_start")}</button>
        <h3 class="mt-s">${t("e.att_list", { n: attendance.ids.length })}</h3>
        <ul class="att-list">${attendance.ids.map((id, i) => `<li><span>${esc(names[i])} <span class="muted small">${esc(id)}</span></span><button class="linkbtn" data-unatt="${esc(id)}">✕</button></li>`).join("")}</ul>
        <div class="inline"><select id="att-add"><option value="">${t("e.choose_member")}</option>${lists.members.filter(m => !attendance.ids.includes(m.id)).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></div>
        <button class="btn btn--gold mt-s" data-act="att-save" ${attendance.ids.length ? "" : "disabled"}>${t("e.att_save")}</button>
      </div>`;
  }

  function donationsHTML() {
    const { t, esc, money, fmtDate } = Z();
    const list = lists.pending_donations || [];
    return backHTML() + `
      <p class="hint">${t("e.don_check")}</p>
      ${list.length ? list.map(d => `
        <div class="card mt-s don">
          <div class="don__top"><strong>${money(d.amount)}</strong><span class="muted">${fmtDate(d.date)}</span></div>
          <div>${esc(d.name)} · ${esc(d.phone)}</div>
          <div class="muted small">${esc(d.operator)} · ${t("e.ref")} <strong>${esc(d.reference)}</strong>${d.show_name ? "" : " · " + t("form.visibility_hide")}</div>
          ${d.message ? `<div class="small">“${esc(d.message)}”</div>` : ""}
          <div class="inline mt-s">
            <button class="btn btn--gold btn--small" data-don="${esc(d.key)}" data-status="Voamarina">${t("e.don_confirm")}</button>
            <button class="btn btn--outline btn--small" data-don="${esc(d.key)}" data-status="Nolavina">${t("e.don_reject")}</button>
          </div>
        </div>`).join("") : `<p class="muted">${t("e.don_none")}</p>`}`;
  }

  function backHTML() { return `<button class="linkbtn e-back" data-act="home">← ${Z().t("e.back")}</button>`; }

  /* ---------- events ---------- */
  function bind(root) {
    const { t, money } = Z();
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
    on("[data-act=dismiss]", "click", () => { failed = []; store.set(K.failed, failed); render(); });
    on("[data-act=home]", "click", () => { view = { name: "home" }; render(); });
    on("[data-act=scan]", "click", () => openScanner(handleCode, false));
    on("[data-go]", "click", e => { const b = e.currentTarget; view = { name: b.dataset.go, id: b.dataset.id }; search = ""; render(); });
    const s = root.querySelector("#e-search");
    if (s) s.addEventListener("input", () => { search = s.value; render(); const n = document.getElementById("e-search"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });

    // fees
    const fee = root.querySelector("#f-fee");
    if (fee) {
      const total = () => {
        const n = fee.querySelectorAll("input[name=month]:checked:not(:disabled)").length;
        fee.querySelector("#fee-total").textContent = t("e.fee_total", { amount: money(n * Z().num(fee.amount.value)) });
      };
      fee.addEventListener("change", total);
      fee.amount.addEventListener("input", total);
      fee.addEventListener("submit", e => {
        e.preventDefault();
        const months = Array.from(fee.querySelectorAll("input[name=month]:checked:not(:disabled)")).map(i => i.value);
        const amount = Z().num(fee.amount.value);
        if (!months.length || !(amount > 0)) { flash = t("e.fee_none"); render(); return; }
        const m = lists.members.find(x => x.id === view.id);
        enqueue("fee", { member_id: view.id, months, amount, date: fee.date.value || today() }, `${m.name}: ${months.join(", ")}`);
        render();
      });
    }
    const pres = root.querySelector("#f-present");
    if (pres) pres.addEventListener("submit", e => {
      e.preventDefault();
      const m = lists.members.find(x => x.id === view.id);
      enqueue("attendance", { member_id: view.id, session: pres.session.value, date: pres.date.value || today() }, `${m.name}: ${pres.session.value}`);
      render();
    });
    on("[data-return]", "click", e => {
      const id = e.currentTarget.dataset.return;
      enqueue("return", { material_id: id, date: today() }, `${id} ${t("e.return")}`);
      render();
    });
    const lend = root.querySelector("#f-lend");
    if (lend) lend.addEventListener("submit", e => {
      e.preventDefault();
      if (!lend.material.value) return;
      enqueue("loan", { material_id: lend.material.value, member_id: view.id, date: today() }, `${lend.material.value} → ${view.id}`);
      render();
    });
    on("[data-act=scan-material]", "click", () => openScanner(code => {
      if (!lists.materials.some(m => m.id === code)) { flash = t("e.unknown_code", { code }); render(); return; }
      enqueue("loan", { material_id: code, member_id: view.id, date: today() }, `${code} → ${view.id}`);
      render();
    }, false));
    const lendTo = root.querySelector("#f-lend-to");
    if (lendTo) lendTo.addEventListener("submit", e => {
      e.preventDefault();
      if (!lendTo.member.value) return;
      enqueue("loan", { material_id: view.id, member_id: lendTo.member.value, date: lendTo.date.value || today() }, `${view.id} → ${lendTo.member.value}`);
      render();
    });
    on("[data-act=scan-member]", "click", () => openScanner(code => {
      if (!lists.members.some(m => m.id === code)) { flash = t("e.unknown_code", { code }); render(); return; }
      enqueue("loan", { material_id: view.id, member_id: code, date: today() }, `${view.id} → ${code}`);
      render();
    }, false));

    // photo
    const pin = root.querySelector("#photo-input");
    if (pin) pin.addEventListener("change", async () => {
      try { newPhoto = { id: view.id, data: await window.ZACard.processPhoto(pin.files[0]) }; }
      catch (e) { flash = t("m.error"); }
      render();
    });
    on("[data-act=photo-save]", "click", () => {
      if (!newPhoto) return;
      const m = lists.members.find(x => x.id === newPhoto.id);
      enqueue("photo", { member_id: newPhoto.id, image: newPhoto.data }, `${t("e.photo")}: ${m ? m.name : newPhoto.id}`);
      newPhoto = null; render();
    });

    // money
    const mon = root.querySelector("#f-money");
    if (mon) mon.addEventListener("submit", e => {
      e.preventDefault();
      const amount = Z().num(mon.amount.value);
      if (!(amount > 0) || !mon.reason.value.trim()) { flash = t("err.missing_fields"); render(); return; }
      const kind = mon.querySelector("input[name=kind]:checked").value;
      enqueue("tx", { kind, amount, reason: mon.reason.value.trim(), category: mon.category.value.trim(), date: mon.date.value || today() },
        `${t(kind === "in" ? "e.in" : "e.out")} ${money(amount)}: ${mon.reason.value.trim()}`);
      view = { name: "home" }; render();
    });

    // attendance mode
    const sess = root.querySelector("#att-session"); if (sess) sess.addEventListener("change", () => { attendance.session = sess.value; });
    const ad = root.querySelector("#att-date"); if (ad) ad.addEventListener("change", () => { attendance.date = ad.value; });
    const add = root.querySelector("#att-add"); if (add) add.addEventListener("change", () => { if (add.value) { attendance.ids.push(add.value); render(); } });
    on("[data-unatt]", "click", e => { attendance.ids = attendance.ids.filter(x => x !== e.currentTarget.dataset.unatt); render(); });
    on("[data-act=att-scan]", "click", () => openScanner(code => {
      const msg = document.getElementById("scan-msg");
      const m = lists.members.find(x => x.id === code);
      if (!m) { msg.textContent = t("e.unknown_code", { code }); return; }
      if (attendance.ids.includes(code)) { msg.textContent = m.name + " – " + t("e.att_already"); return; }
      attendance.ids.push(code);
      msg.textContent = "✓ " + m.name + " (" + attendance.ids.length + ")";
    }, true));
    on("[data-act=att-save]", "click", () => {
      attendance.ids.forEach(id => {
        const m = lists.members.find(x => x.id === id);
        queue.push({ op_id: uid(), type: "attendance", data: { member_id: id, session: attendance.session, date: attendance.date }, label: `${m ? m.name : id}: ${attendance.session}`, at: new Date().toISOString() });
      });
      store.set(K.queue, queue);
      flash = t("e.att_list", { n: attendance.ids.length }) + " · " + t("e.saved");
      attendance = null; view = { name: "home" }; render(); sync();
    });

    // donations
    on("[data-don]", "click", e => {
      const b = e.currentTarget;
      const d = (lists.pending_donations || []).find(x => x.key === b.dataset.don);
      enqueue("donation_status", { key: b.dataset.don, status: b.dataset.status }, `${d ? d.name : ""} ${d ? Z().money(d.amount) : ""}: ${b.dataset.status}`);
      render();
    });
  }

  /* ---------- start ---------- */
  window.renderEntryPage = async function () {
    if (!window.__entryInit) {
      window.__entryInit = true;
      document.getElementById("scan-close").addEventListener("click", closeScanner);
      window.addEventListener("online", () => { renderStatus(); sync(); refreshLists().then(renderStatus).catch(() => {}); });
      window.addEventListener("offline", renderStatus);
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
      if (token && navigator.onLine) { sync(); refreshLists().then(render).catch(() => {}); }
    }
    render();
  };
})();
