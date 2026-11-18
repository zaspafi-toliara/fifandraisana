/* ==========================================================
   ZA SPaFi Toliara – invitation form (fanasana.html)
   Public page, meant to be shared on social media.
   The letter (PDF or photo) is sent with the form to the
   Apps Script, saved in a private Drive folder, and a row is
   added to the "Fanasana" tab. The Birao and the chosen
   Fifandraisana contact get an SMS; the choir's Gmail gets an email.
   The visitor only sees the "Misaotra betsaka!" screen.
   ========================================================== */
(function () {
  "use strict";
  const MAX_BYTES = 8 * 1024 * 1024;
  let ready = false, sending = false;

  /* Photos are reduced (max 1800 px, JPEG) so they send quickly on mobile data; PDFs are sent as they are */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("missing_file"));
      const okType = ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
      if (!okType || file.size > MAX_BYTES) return reject(new Error("missing_file"));
      if (file.type === "application/pdf") {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("missing_file"));
        r.readAsDataURL(file);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("missing_file")); };
      img.src = url;
    });
  }

  const ERR = { missing_file: "inv.err_file", file_too_big: "inv.err_file", bad_phone: "inv.err_phone",
                bad_email: "inv.err_email", too_fast: "inv.err_fast", missing_fields: "err.missing_fields" };

  async function submit(form) {
    const { t } = window.ZA;
    const msg = document.getElementById("i-msg");
    const btn = form.querySelector("button[type=submit]");
    msg.innerHTML = "";
    const v = n => form.elements[n].value.trim();
    if (form.elements.website.value) return;                                   // spam trap
    if (!v("name") || !v("group") || !v("phone") || !v("subject") || !v("event_date")) { msg.innerHTML = `<div class="alert alert--err">${t("err.missing_fields")}</div>`; return; }
    if (v("phone").replace(/\D/g, "").length < 9) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_phone")}</div>`; return; }
    if (v("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_email")}</div>`; return; }
    let file;
    try { file = await readFile(form.elements.file.files[0]); }
    catch (e) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_file")}</div>`; return; }

    sending = true; btn.disabled = true; btn.textContent = t("inv.sending");
    const payload = { action: "invite", name: v("name"), group: v("group"), phone: v("phone"), email: v("email"),
                      subject: v("subject"), event_date: v("event_date"), file, lang: window.ZA.lang(), website: "" };
    const CFG = window.SITE_CONFIG || {};
    try {
      let out = { ok: true, demo: true };
      if (CFG.API_URL) {
        const res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        out = await res.json();
      }
      if (!out.ok) throw new Error(out.error || "error");
      document.getElementById("invite-app").innerHTML = `
        <div class="invite-ok">
          <div class="invite-ok__ico">✓</div>
          <h2>${t("inv.ok_title")}</h2>
          <p>${t("inv.ok_text")}</p>
          ${out.demo ? `<p class="demo-note">${t("inv.demo")}</p>` : ""}
          <a class="btn btn--outline" href="fanasana.html">${t("inv.again")}</a>
        </div>`;
      document.getElementById("invite-app").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      msg.innerHTML = `<div class="alert alert--err">${t(ERR[e.message] || "form.error")}</div>`;
      btn.disabled = false; btn.textContent = t("inv.send");
    }
    sending = false;
  }

  /* ---------- availability calendar: Sundays only ---------- */
  let calYear = new Date().getFullYear();
  const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const todayIso = () => isoOf(new Date());
  function busySet() { const D = window.ZA.data && window.ZA.data(); return new Set((D && D.busy) || []); }

  function renderCalendar() {
    const box = document.getElementById("cal-app"); if (!box) return;
    const { t } = window.ZA;
    const busy = busySet(), today = todayIso(), thisYear = new Date().getFullYear();
    const sel = (document.getElementById("i-date") || {}).value || "";
    let html = `<div class="cal-head">
        <button type="button" class="btn btn--outline btn--small" data-cal="-1" ${calYear <= thisYear ? "disabled" : ""}>‹</button>
        <strong class="cal-year">${calYear}</strong>
        <button type="button" class="btn btn--outline btn--small" data-cal="1" ${calYear >= thisYear + 1 ? "disabled" : ""}>›</button>
        <span class="cal-legend"><span class="cal-day is-free">${t("cal.free")}</span><span class="cal-day is-busy">${t("cal.busy")}</span></span>
      </div><div class="cal-grid">`;
    const firstMonth = calYear === thisYear ? new Date().getMonth() : 0;   // past months are not shown
    for (let m = firstMonth; m < 12; m++) {
      const days = [];
      const d = new Date(calYear, m, 1);
      while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
      for (; d.getMonth() === m; d.setDate(d.getDate() + 7)) days.push(new Date(d));
      html += `<div class="cal-month"><div class="cal-month__name">${t("month." + (m + 1))}</div><div class="cal-days">` +
        days.map(x => {
          const iso = isoOf(x), past = iso < today, isBusy = busy.has(iso);
          const cls = past ? "is-past" : isBusy ? "is-busy" : "is-free";
          const label = past ? "" : isBusy ? t("cal.busy") : t("cal.free");
          return `<button type="button" class="cal-day ${cls}${iso === sel ? " is-sel" : ""}" data-day="${iso}" ${past || isBusy ? "disabled" : ""}
                   title="${label}" aria-label="${x.getDate()} ${t("month." + (m + 1))} ${calYear}: ${label}">${x.getDate()}</button>`;
        }).join("") + `</div></div>`;
    }
    box.innerHTML = html + `</div><p class="hint">${t("cal.pick")}</p>`;
    box.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("click", () => { calYear += Number(b.dataset.cal); renderCalendar(); }));
    box.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => {
      const input = document.getElementById("i-date"); if (!input) return;
      input.value = b.dataset.day; dateNote(); renderCalendar();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  /* Warning under the date: not a Sunday, or Sunday already taken */
  function dateNote() {
    const { t } = window.ZA;
    const input = document.getElementById("i-date"), box = document.getElementById("i-date-note");
    if (!input || !box) return;
    const v = input.value; box.innerHTML = "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const d = new Date(v + "T12:00:00");
    if (d.getDay() !== 0) box.innerHTML = `<div class="alert alert--warn">${t("cal.not_sunday")}</div>`;
    else if (busySet().has(v)) box.innerHTML = `<div class="alert alert--warn">${t("cal.taken")}</div>`;
    else box.innerHTML = `<div class="alert alert--ok">${t("cal.ok")}</div>`;
  }

  window.renderInvitePage = function () {
    if (ready) return;
    const form = document.getElementById("f-invite");
    if (!form || !window.ZA) return;
    ready = true;
    const input = document.getElementById("i-date");
    if (input) { input.min = todayIso(); input.addEventListener("change", () => { dateNote(); renderCalendar(); }); }
    renderCalendar();
    form.addEventListener("submit", e => { e.preventDefault(); if (!sending) submit(form); });
  };
})();
