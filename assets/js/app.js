/* ==========================================================
   ZA SPaFI Toliara – site script
   - loads the translations (i18n/strings.csv)
   - loads the data (Apps Script API, or sample JSON while API_URL is empty)
   - builds the header/footer and each page's content
   ========================================================== */
(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const PAGE = document.body.dataset.page || "home";
  let STRINGS = {};      // key -> {en, mg}
  let LANG = getLang();
  let DATA = null;
  let VERSES = [];

  /* ---------- small helpers ---------- */
  function getLang() {
    try { return localStorage.getItem("lang") || CFG.DEFAULT_LANG || "mg"; }
    catch (e) { return CFG.DEFAULT_LANG || "mg"; }
  }
  function setLang(l) {
    try { localStorage.setItem("lang", l); } catch (e) { /* private mode */ }
    LANG = l; document.documentElement.lang = l;
    applyStrings(); renderPage();
  }
  // t("goals.progress", {done: 2, total: 5})
  function t(key, vars) {
    const s = STRINGS[key];
    let txt = s ? (s[LANG] || s.en || key) : key;
    if (vars) Object.keys(vars).forEach(k => { txt = txt.replace("{" + k + "}", vars[k]); });
    return txt;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // 1250000 -> "1 250 000 Ar"
  function money(n) {
    const v = Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return v + " " + t("common.currency");
  }
  // "2026-11-08" -> "8 Novambra 2026" / "8 novembre 2026"
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return iso;
    return d.getDate() + " " + t("month." + (d.getMonth() + 1)) + " " + d.getFullYear();
  }
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- CSV parser (handles quotes, commas, line breaks) ---------- */
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ""; let q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift() || [];
    return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
  }

  /* ---------- loading ---------- */
  // Files are read with fetch(). When the page is opened directly from the
  // disk (file://) the browser blocks fetch, so we fall back to the copy in
  // assets/js/content.js (rebuild it with R/build_content.R after edits).
  const BUNDLE = window.SITE_CONTENT || {};
  async function fetchText(path, bundleKey) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (BUNDLE[bundleKey]) return BUNDLE[bundleKey];
      throw e;
    }
  }
  async function loadStrings() {
    const txt = await fetchText("i18n/strings.csv", "strings");
    parseCSV(txt).forEach(r => { STRINGS[r.key] = { en: r.en, mg: r.mg || r.en, fr: r.fr || r.en }; });
  }
  async function loadVerses() {
    try { VERSES = parseCSV(await fetchText("data/verses.csv", "verses")); }
    catch (e) { VERSES = []; }
  }
  async function loadData() {
    if (CFG.API_URL) {
      const res = await fetch(CFG.API_URL + "?action=public", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      DATA = await res.json();
    } else {
      DATA = JSON.parse(await fetchText("data/sample-public.json", "sample"));
    }
  }

  /* ---------- translations in the HTML ---------- */
  function applyStrings() {
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll(".lang-switch button").forEach(b => b.classList.toggle("is-active", b.dataset.lang === LANG));
  }

  /* ---------- header & footer (shared by every page) ---------- */
  function buildChrome() {
    const cur = p => (PAGE === p ? ' aria-current="page"' : "");
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="container site-header__inner">
        <a class="brand" href="index.html"><img src="assets/img/logo-192.png" alt=""><span data-i18n="site.name"></span></a>
        <button class="nav-toggle" aria-expanded="false" data-i18n-aria="nav.menu"><span></span><span></span><span></span></button>
        <nav class="nav" id="nav">
          <a href="index.html"${cur("home")} data-i18n="nav.home"></a>
          <a href="mombamomba.html"${cur("about")} data-i18n="nav.about"></a>
          <a href="fanomezana.html"${cur("donate")} data-i18n="nav.donate"></a>
          <a href="mpikambana.html" class="nav__login"${cur("login")} data-i18n="nav.login"></a>
          <div class="lang-switch" role="group" data-i18n-aria="nav.lang">
            <button type="button" data-lang="mg">MG</button><button type="button" data-lang="fr">FR</button><button type="button" data-lang="en">EN</button>
          </div>
        </nav>
      </div>`;
    document.body.prepend(header);

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    const off = CFG.OFFICIAL || {};
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand"><img src="assets/img/logo-192.png" alt=""><strong data-i18n="site.name"></strong></div>
            <p data-i18n="site.fullname"></p>
            <p><em data-i18n="footer.tagline"></em></p>
          </div>
          <div>
            <h4 data-i18n="footer.links"></h4>
            <ul>
              <li><a href="index.html" data-i18n="nav.home"></a></li>
              <li><a href="mombamomba.html" data-i18n="nav.about"></a></li>
              <li><a href="fanomezana.html" data-i18n="nav.donate"></a></li>
            </ul>
          </div>
          <div>
            <h4 data-i18n="footer.contact"></h4>
            <ul>
              <li>${esc(off.address || "")}</li>
              <li>${esc(off.contact || "")}</li>
              ${off.email ? `<li><a href="mailto:${esc(off.email)}">${esc(off.email)}</a></li>` : ""}
              ${off.facebook ? `<li><a href="${esc(off.facebook)}" target="_blank" rel="noopener">Facebook</a></li>` : ""}
            </ul>
          </div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} ZA SPaFI Toliara · <span data-i18n="footer.rights"></span></div>
      </div>`;
    document.body.append(footer);

    const toggle = $(".nav-toggle"), nav = $("#nav");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
    });
    document.querySelectorAll(".lang-switch button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  }

  function showDemoBanner() {
    if (PAGE === "login" || !DATA || !DATA.sample || $(".demo-banner")) return;
    const b = document.createElement("div");
    b.className = "demo-banner"; b.dataset.i18n = "demo.banner"; b.textContent = t("demo.banner");
    $(".site-header").after(b);
  }

  /* ---------- verses ---------- */
  function verseFor(use, daily) {
    const list = VERSES.filter(v => v.use === use);
    if (!list.length) return null;
    const i = daily ? Math.floor(Date.now() / 86400000) % list.length : 0;
    return list[i];
  }
  function verseHTML(v) {
    if (!v) return "";
    const text = v["text_" + LANG] || v.text_mg;
    const ref = v["ref_" + LANG] || v.ref_mg;
    return `<blockquote>“${esc(text)}”</blockquote><cite>${esc(ref)}</cite>`;
  }
  function renderVerses() {
    document.querySelectorAll("[data-verse]").forEach(el => {
      el.innerHTML = verseHTML(verseFor(el.dataset.verse, el.dataset.verse === "home"));
    });
  }

  /* ---------- goals ---------- */
  function renderGoals() {
    const box = $("#goals"); if (!box) return;
    const goals = (DATA && DATA.goals) || [];
    if (!goals.length) { box.innerHTML = `<p class="center muted">${t("goals.empty")}</p>`; return; }
    box.innerHTML = goals.map((g, gi) => {
      const total = g.steps.length;
      const done = g.steps.filter(s => s.status === "done").length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const steps = g.steps.map(s => `
        <li class="step step--${esc(s.status)}">
          <div class="step__title">${esc(s.title)}<span class="badge badge--${esc(s.status)}">${t("goals." + s.status)}</span></div>
          ${s.date ? `<div class="step__info">${fmtDate(s.date)}</div>` : ""}
        </li>`).join("");
      return `
        <article class="goal">
          <h3>${esc(g.title)}</h3>
          ${g.description ? `<p class="goal__desc">${esc(g.description)}</p>` : ""}
          <div class="goal__meta"><strong>${t("goals.progress", { done, total })}</strong>
            ${g.target_date ? `<span>${t("goals.target")}: ${fmtDate(g.target_date)}</span>` : ""}</div>
          <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress__bar" style="width:${pct}%"></div></div>
          <button class="goal__toggle" aria-expanded="false" aria-controls="steps-${gi}">${t("goals.show_steps")}</button>
          <ol class="steps" id="steps-${gi}" hidden>${steps}</ol>
        </article>`;
    }).join("");
    box.querySelectorAll(".goal__toggle").forEach(btn => btn.addEventListener("click", () => {
      const list = document.getElementById(btn.getAttribute("aria-controls"));
      list.hidden = !list.hidden;
      btn.setAttribute("aria-expanded", !list.hidden);
      btn.textContent = t(list.hidden ? "goals.show_steps" : "goals.hide_steps");
    }));
  }

  /* ---------- donations ---------- */
  function donations() {
    return ((DATA && DATA.donations) || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function donationRows(list) {
    return list.map(d => `
      <tr class="${d.name ? "" : "is-anon"}">
        <td class="date">${fmtDate(d.date)}</td>
        <td class="donor">${d.name ? esc(d.name) : t("donors.anonymous")}</td>
        <td class="num">${money(d.amount)}</td>
      </tr>`).join("");
  }
  function renderDonationSummary() {
    const box = $("#donation-summary"); if (!box) return;
    const list = donations();
    const total = list.reduce((s, d) => s + Number(d.amount || 0), 0);
    box.innerHTML = `
      <div class="stat">
        <div class="stat__label">${t("home.donations_total")}</div>
        <div class="stat__value">${money(total)}</div>
        <div class="stat__sub">${list.length} ${t("home.donations_count")}</div>
        <a class="btn btn--gold" href="fanomezana.html">${t("home.cta_btn")}</a>
      </div>
      <div class="card">
        <h3>${t("home.donations_recent")}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>${t("donors.col_date")}</th><th>${t("donors.col_donor")}</th><th class="num">${t("donors.col_amount")}</th></tr></thead>
          <tbody>${list.length ? donationRows(list.slice(0, 5)) : `<tr><td colspan="3" class="muted">${t("donors.empty")}</td></tr>`}</tbody>
        </table></div>
        <div class="list-actions"><a class="btn btn--outline btn--small" href="fanomezana.html#donors">${t("common.see_all")}</a></div>
      </div>`;
  }
  let showAll = false;
  function renderDonorList() {
    const box = $("#donor-list"); if (!box) return;
    const list = donations();
    const n = CFG.DONATIONS_PREVIEW || 10;
    const shown = showAll ? list : list.slice(0, n);
    const total = list.reduce((s, d) => s + Number(d.amount || 0), 0);
    box.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>${t("donors.col_date")}</th><th>${t("donors.col_donor")}</th><th class="num">${t("donors.col_amount")}</th></tr></thead>
        <tbody>${list.length ? donationRows(shown) : `<tr><td colspan="3" class="muted">${t("donors.empty")}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="2">${t("donors.total")} (${list.length})</td><td class="num">${money(total)}</td></tr></tfoot>
      </table></div>
      ${list.length > n ? `<div class="list-actions"><button class="btn btn--outline btn--small" id="toggle-donors">${t(showAll ? "common.show_less" : "common.see_all")}</button></div>` : ""}`;
    const btn = $("#toggle-donors");
    if (btn) btn.addEventListener("click", () => { showAll = !showAll; renderDonorList(); });
  }

  /* ---------- mobile money & donation form ---------- */
  function renderMobileMoney() {
    const box = $("#mobile-money"); if (!box) return;
    box.innerHTML = (CFG.MOBILE_MONEY || []).map((m, i) => `
      <div class="mm">
        <div class="mm__op">${esc(m.operator)}</div>
        <div class="mm__row"><span class="mm__number" id="mm-${i}">${esc(m.number)}</span>
          <button type="button" class="btn btn--navy btn--small" data-copy="${esc(m.number.replace(/\s/g, ""))}">${t("donate.copy")}</button></div>
        <div class="mm__holder">${t("donate.mm_holder")}: <strong>${esc(m.holder)}</strong> · ${t("donate.mm_role")}</div>
      </div>`).join("");
    box.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => copy(b.dataset.copy, b, "donate.copied", "donate.copy")));
    const sel = $("#f-operator");
    if (sel) {
      const ops = ["MVola", "Orange Money", "Airtel Money"];
      sel.innerHTML = ops.map(o => `<option>${o}</option>`).join("") + `<option value="other">${t("form.operator_other")}</option>`;
    }
  }
  function copy(text, btn, okKey, backKey) {
    const done = () => { btn.textContent = t(okKey); setTimeout(() => { btn.textContent = t(backKey); }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
  }
  function initDonationForm() {
    const form = $("#donation-form"); if (!form || form.dataset.ready) return;
    form.dataset.ready = "1";
    const dateInput = $("#f-date");
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#form-msg"); msg.innerHTML = "";
      const fd = new FormData(form);
      if (fd.get("website")) return;                       // spam trap
      const amount = Number(String(fd.get("amount")).replace(/\s/g, ""));
      if (!amount || amount <= 0) { msg.innerHTML = `<div class="alert alert--err">${t("form.invalid_amount")}</div>`; return; }
      const payload = {
        action: "donation",
        name: fd.get("name"), phone: fd.get("phone"), amount,
        operator: fd.get("operator"), reference: fd.get("reference"),
        date: fd.get("date"), show_name: fd.get("visibility") === "show",
        message: fd.get("message")
      };
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = t("form.sending");
      try {
        if (CFG.API_URL) {
          // text/plain avoids a CORS pre-flight with Google Apps Script
          const res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
          const out = await res.json();
          if (!out.ok) throw new Error(out.error || "error");
          msg.innerHTML = `<div class="alert alert--ok">${t("form.success")}</div>`;
        } else {
          msg.innerHTML = `<div class="alert alert--ok">${t("form.success")}<br><small>${t("form.demo")}</small></div>`;
        }
        form.reset(); if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      } catch (err) {
        msg.innerHTML = `<div class="alert alert--err">${t("form.error")}</div>`;
      } finally {
        btn.disabled = false; btn.textContent = t("form.submit");
      }
    });
    const share = $("#share-btn");
    if (share) share.addEventListener("click", () => {
      const url = location.href.split("#")[0];
      if (navigator.share) navigator.share({ title: "ZA SPaFI Toliara", text: t("home.cta_title"), url }).catch(() => {});
      else copy(url, share, "share.copied", "share.btn");
    });
  }

  /* ---------- about page ---------- */
  function renderAbout() {
    const off = CFG.OFFICIAL || {};
    const facts = $("#facts");
    if (facts) {
      const rows = [["about.trust_church", off.church], ["about.trust_synod", off.synod], ["about.trust_reg", off.reg],
        ["about.trust_address", off.address], ["about.trust_contact", off.contact]];
      let html = rows.filter(r => r[1]).map(r => `<dt>${t(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("");
      if (off.email) html += `<dt>Email</dt><dd><a href="mailto:${esc(off.email)}">${esc(off.email)}</a></dd>`;
      if (off.facebook) html += `<dt>${t("about.trust_facebook")}</dt><dd><a href="${esc(off.facebook)}" target="_blank" rel="noopener">${esc(off.facebook)}</a></dd>`;
      facts.innerHTML = html;
    }
    const office = $("#office");
    if (office) office.innerHTML = ((DATA && DATA.office) || []).map(o =>
      `<div class="office__item"><div class="office__role">${esc(o.role)}</div><div class="office__name">${esc(o.name)}</div></div>`).join("");
    const com = $("#commissions");
    if (com) com.innerHTML = (CFG.COMMISSIONS || []).map(c => `<span class="chip">${esc(c)}</span>`).join("");
    const docs = CFG.DOCS || {};
    const s = $("#doc-statutes"), r = $("#doc-rules");
    if (s && docs.statutes) s.href = docs.statutes;
    if (r && docs.rules) r.href = docs.rules;
  }

  /* ---------- page render ---------- */
  function renderPage() {
    renderVerses();
    renderGoals();
    renderDonationSummary();
    renderDonorList();
    renderMobileMoney();
    renderAbout();
    initDonationForm();
    if (window.renderMembersPage) window.renderMembersPage();
    if (window.renderEntryPage) window.renderEntryPage();
    if (window.renderCardsPage) window.renderCardsPage();
  }

  // helpers shared with members.js
  const num = v => Number(String(v == null ? "" : v).replace(/\D/g, "")) || 0;   // Ariary: whole numbers
  window.ZA = { t, esc, money, fmtDate, fetchText, num, lang: () => LANG };

  async function init() {
    document.documentElement.lang = LANG;
    buildChrome();
    try { await loadStrings(); } catch (e) { console.error("strings", e); }
    applyStrings();
    await loadVerses();
    // public data is not needed on the staff/members pages
    const needsPublic = ["home", "about", "donate"].indexOf(PAGE) >= 0;
    try { if (needsPublic) await loadData(); }
    catch (e) {
      console.error("data", e);
      document.querySelectorAll("[data-needs-data]").forEach(el => { el.innerHTML = `<p class="alert alert--err">${t("common.error_load")}</p>`; });
    }
    showDemoBanner();
    renderPage();
  }
  init();
})();
