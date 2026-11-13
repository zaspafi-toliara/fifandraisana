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
    if (!v("name") || !v("group") || !v("phone") || !v("subject")) { msg.innerHTML = `<div class="alert alert--err">${t("err.missing_fields")}</div>`; return; }
    if (v("phone").replace(/\D/g, "").length < 9) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_phone")}</div>`; return; }
    if (v("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_email")}</div>`; return; }
    let file;
    try { file = await readFile(form.elements.file.files[0]); }
    catch (e) { msg.innerHTML = `<div class="alert alert--err">${t("inv.err_file")}</div>`; return; }

    sending = true; btn.disabled = true; btn.textContent = t("inv.sending");
    const payload = { action: "invite", name: v("name"), group: v("group"), phone: v("phone"), email: v("email"),
                      subject: v("subject"), file, lang: window.ZA.lang(), website: "" };
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

  window.renderInvitePage = function () {
    if (ready) return;
    const form = document.getElementById("f-invite");
    if (!form || !window.ZA) return;
    ready = true;
    form.addEventListener("submit", e => { e.preventDefault(); if (!sending) submit(form); });
  };
})();
