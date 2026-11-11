/* ==========================================================
   ZA SPaFi Toliara – member cards and material labels
   - window.ZACard.card(member) / .label(material): HTML with a QR code
   - karatra.html: choose members/materials and print on A4
   The QR code contains only the ID (e.g. ZA-001, ZE-01).
   ========================================================== */
(function () {
  "use strict";

  function qrSvg(text) {
    if (!window.qrcode) return "";
    const qr = window.qrcode(0, "M");
    qr.addData(String(text));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  const esc = s => (window.ZA ? window.ZA.esc(s) : String(s));
  const t = (k, v) => (window.ZA ? window.ZA.t(k, v) : k);

  /* Photo of a member: a local picture not yet sent (photo_data) or the Drive file */
  function photoSrc(m) {
    if (m.photo_data) return m.photo_data;
    if (m.photo) return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(m.photo) + "&sz=w400";
    return "";
  }
  function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }
  function photoHTML(m, cls) {
    const src = photoSrc(m);
    return `<div class="${cls}">${src
      ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://lh3.googleusercontent.com/d/${esc(m.photo || "")}=w400'">`
      : `<span>${esc(initials(m.name))}</span>`}</div>`;
  }

  function card(m) {
    return `
      <div class="idcard">
        <div class="idcard__band">
          <img src="assets/img/logo-192.png" alt="">
          <div><strong>ZA SPaFi Toliara</strong><span>Zanaka Ampielezana Synodam-Paritany Fisakana eto Toliara</span></div>
        </div>
        <div class="idcard__body">
          ${photoHTML(m, "idcard__photo")}
          <div class="idcard__info">
            <div class="idcard__label">${esc(t("c.card_member"))}</div>
            <div class="idcard__name">${esc(m.name)}</div>
            ${m.commission ? `<div class="idcard__line">${esc(m.commission)}</div>` : ""}
            ${m.role ? `<div class="idcard__line">${esc(m.role)}</div>` : ""}
            <div class="idcard__id">${esc(m.id)}</div>
          </div>
          <div class="idcard__qr">${qrSvg(m.id)}</div>
        </div>
        <div class="idcard__foot">“Fa tsy menatra ny filazantsara aho” – Romana 1:16a</div>
      </div>`;
  }

  /* Reads a picture chosen or taken on the phone, crops it to a 3:4 portrait
     (centre) and resizes it to 300 × 400 px JPEG (~30–50 KB). */
  function processPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error("not_image")); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const W = 300, H = 400, ratio = W / H;
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; }
        else { const nh = sw / ratio; sy = Math.max(0, (sh - nh) * 0.35); sh = nh; }   // keep a bit more of the top (head)
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
      img.src = url;
    });
  }

  function label(x) {
    return `
      <div class="mlabel">
        <div class="mlabel__qr">${qrSvg(x.id)}</div>
        <div class="mlabel__txt"><div class="mlabel__id">${esc(x.id)}</div>
          <div>${esc(x.type)}${x.size ? " · " + esc(x.size) : ""}</div>
          <div class="mlabel__org">ZA SPaFi Toliara</div></div>
      </div>`;
  }

  window.ZACard = { card, label, qrSvg, processPhoto, photoSrc, photoHTML };

  /* ---------- karatra.html ---------- */
  let lists = null, tab = "members", selected = new Set(), commission = "", loaded = false, error = "";

  async function load() {
    loaded = true;
    const CFG = window.SITE_CONFIG || {};
    let token = null;
    try { token = JSON.parse(localStorage.getItem("za_dev_token")); } catch (e) { /* none */ }
    try {
      if (!CFG.API_URL) lists = JSON.parse(await window.ZA.fetchText("data/sample-lists.json", "lists"));
      else if (!token) error = "c.login_needed";
      else {
        const res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "staff_lists", token }) });
        const r = await res.json();
        if (r.ok) lists = r; else error = "c.login_needed";
      }
    } catch (e) {
      // offline: use the lists saved by the entry app
      try { lists = JSON.parse(localStorage.getItem("za_lists")); } catch (e2) { lists = null; }
      if (!lists) error = "common.error_load";
    }
    if (lists) lists.members.forEach(m => selected.add(m.id));
    render();
  }

  function items() {
    if (!lists) return [];
    return tab === "members"
      ? lists.members.filter(m => !commission || m.commission === commission)
      : lists.materials;
  }

  function render() {
    const root = document.getElementById("cards-app");
    if (!root || !window.ZA) return;
    if (error) { root.innerHTML = `<div class="alert alert--err">${t(error)} <a href="fampidirana.html">${t("nav.entry")}</a></div>`; return; }
    if (!lists) { root.innerHTML = `<p class="muted">${t("common.loading")}</p>`; return; }
    const list = items();
    const comms = Array.from(new Set(lists.members.map(m => m.commission).filter(Boolean)));
    const n = list.filter(x => selected.has(x.id)).length;
    root.innerHTML = `
      <div class="tabs">
        <button class="tab ${tab === "members" ? "is-active" : ""}" data-tab="members">${t("c.tab_members")}</button>
        <button class="tab ${tab === "materials" ? "is-active" : ""}" data-tab="materials">${t("c.tab_materials")}</button>
      </div>
      <div class="c-tools">
        <button class="btn btn--outline btn--small" data-all>${t("c.all")}</button>
        <button class="btn btn--outline btn--small" data-none>${t("c.none")}</button>
        ${tab === "members" ? `<select id="c-comm"><option value="">${t("m.commission")}: ${t("c.all")}</option>${comms.map(c => `<option ${c === commission ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>` : ""}
        <span class="muted">${t("c.selected", { n })}</span>
        <button class="btn btn--gold" data-print ${n ? "" : "disabled"}>${t("c.print")}</button>
      </div>
      <div class="c-list">${list.map(x => `
        <label class="c-item"><input type="checkbox" value="${esc(x.id)}" ${selected.has(x.id) ? "checked" : ""}>
          <strong>${esc(x.id)}</strong> ${esc(x.name || (x.type + (x.size ? " " + x.size : "")))}</label>`).join("")}</div>`;
    const area = document.getElementById("print-area");
    const chosen = list.filter(x => selected.has(x.id));
    area.className = "print-area " + (tab === "members" ? "print-area--cards" : "print-area--labels");
    area.innerHTML = chosen.map(x => tab === "members" ? card(x) : label(x)).join("");

    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
      tab = b.dataset.tab; selected = new Set(items().map(x => x.id)); render();
    }));
    root.querySelector("[data-all]").addEventListener("click", () => { items().forEach(x => selected.add(x.id)); render(); });
    root.querySelector("[data-none]").addEventListener("click", () => { items().forEach(x => selected.delete(x.id)); render(); });
    const c = root.querySelector("#c-comm"); if (c) c.addEventListener("change", () => { commission = c.value; render(); });
    root.querySelectorAll(".c-item input").forEach(i => i.addEventListener("change", () => { i.checked ? selected.add(i.value) : selected.delete(i.value); render(); }));
    root.querySelector("[data-print]").addEventListener("click", () => window.print());
  }

  window.renderCardsPage = function () {
    if (document.body.dataset.page !== "cards") return;
    if (!loaded) load();
    render();
  };
})();
