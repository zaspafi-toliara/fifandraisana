/* ==========================================================
   ZA SPaFi Toliara – official letters (taratasy.html)
   For the Birao, Mpandrindra and Vaomiera Fifandraisana.
   Fixed parts: header with the two logos, the blessing and the
   Filoha signature. Entered: title, Antony, body (+ salutation,
   closing, place/date, Filoha name, all pre-filled).
   The PDF (A4, always ONE page) is made in the browser with jsPDF:
   when the body is long, spacing is reduced first, then the font
   size (11 pt → 8 pt minimum).
   Body syntax: each line = one paragraph; "- " at the start = list
   item; a tab (⇥ button) at the start = indented first line;
   **text** = bold.
   ========================================================== */
(function () {
  "use strict";

  const PAGE_W = 210, PAGE_H = 297, ML = 22, MR = 22, BOTTOM = 284, PT = 0.3528;   // mm
  const HEADER = ["FIANGONANA LOTERANA MALAGASY", "SYNODAM-PARITANY FISAKANA", "ZANAKA AMPIELEZANA", "ETO TOLIARA"];
  const BLESSING = "Hampitomboina aminareo mandrakariva anie ny fahasoavana sy ny fiadanana avy amin’Andriamanitra Ray sy Jesosy Kristy Tompontsika,";
  const SIGN_TITLE = "Ny filohan’ny ZA SPaFi Toliara";
  const MONTHS = ["Janoary", "Febroary", "Martsa", "Aprily", "Mey", "Jona", "Jolay", "Aogositra", "Septambra", "Oktobra", "Novambra", "Desambra"];
  const FONT_FILES = { R: "assets/fonts/Arimo-Regular.ttf", B: "assets/fonts/Arimo-Bold.ttf", T: "assets/fonts/Merriweather-Bold.ttf" };
  const PDF_FONT = { R: ["Arimo", "normal"], B: ["Arimo", "bold"], T: ["Merriweather", "bold"] };
  const CSS_FONT = { R: "400 {s}px ZLArimo", B: "700 {s}px ZLArimo", T: "700 {s}px ZLMerri" };
  const DRAFT_KEY = "za_letter_draft";

  let ready = false, fonts = null, imgs = null, measureDoc = null, lastLayout = null, filoha = "";
  const Z = () => window.ZA;

  /* ---------- resources ---------- */
  function b64(buf) {
    let s = ""; const a = new Uint8Array(buf);
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function loadFonts() {
    const out = {};
    for (const k of Object.keys(FONT_FILES)) {
      const res = await fetch(FONT_FILES[k]);
      if (!res.ok) throw new Error("font");
      out[k] = await res.arrayBuffer();
    }
    // the same files for the on-screen preview
    const faces = [new FontFace("ZLArimo", out.R, { weight: "400" }), new FontFace("ZLArimo", out.B, { weight: "700" }), new FontFace("ZLMerri", out.T, { weight: "700" })];
    await Promise.all(faces.map(f => f.load())); faces.forEach(f => document.fonts.add(f));
    return { R: b64(out.R), B: b64(out.B), T: b64(out.T) };
  }
  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {   // keep a JPEG data URL for jsPDF
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0);
        resolve({ el: im, data: c.toDataURL("image/jpeg", 0.92) });
      };
      im.onerror = reject; im.src = src;
    });
  }
  function newDoc() {
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.addFileToVFS("Arimo-Regular.ttf", fonts.R); doc.addFont("Arimo-Regular.ttf", "Arimo", "normal");
    doc.addFileToVFS("Arimo-Bold.ttf", fonts.B); doc.addFont("Arimo-Bold.ttf", "Arimo", "bold");
    doc.addFileToVFS("Merriweather-Bold.ttf", fonts.T); doc.addFont("Merriweather-Bold.ttf", "Merriweather", "bold");
    return doc;
  }
  function width(text, font, size) {
    measureDoc.setFont(PDF_FONT[font][0], PDF_FONT[font][1]); measureDoc.setFontSize(size);
    return measureDoc.getTextWidth(text);
  }

  /* ---------- text model ---------- */
  /* "Ny **Alahady 22** amin'ny" -> words, each made of runs {t, b} */
  function words(line) {
    const out = []; let bold = false, cur = [];
    const parts = line.split("**");
    parts.forEach((part, i) => {
      if (i > 0) bold = !bold;
      const bits = part.split(/(\s+)/);
      bits.forEach(bit => {
        if (bit === "") return;
        if (/^\s+$/.test(bit)) { if (cur.length) { out.push(cur); cur = []; } return; }
        cur.push({ t: bit, b: bold });
      });
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function blocks(body) {
    return String(body || "").replace(/\r/g, "").split("\n").map(raw => {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) return null;
      const m = line.match(/^\s*[-•*]\s+(.*)$/);
      if (m && !/^\s*\*\*/.test(line)) return { kind: "bullet", words: words(m[1]) };
      if (/^(\t|\s{3,})/.test(line)) return { kind: "indent", words: words(line.trim()) };
      return { kind: "para", words: words(line.trim()) };
    }).filter(Boolean);
  }

  /* Break words into lines that fit; returns [{words, last}] */
  function breakLines(ws, firstW, restW, size) {
    const sp = width(" ", "R", size);
    const wWidth = w => w.reduce((s, r) => s + width(r.t, r.b ? "B" : "R", size), 0);
    const lines = []; let cur = [], curW = 0;
    ws.forEach(w => {
      const ww = wWidth(w), max = lines.length ? restW : firstW;
      if (cur.length && curW + sp + ww > max) { lines.push({ words: cur, w: curW }); cur = []; curW = 0; }
      curW += (cur.length ? sp : 0) + ww; cur.push({ runs: w, w: ww });
    });
    if (cur.length) lines.push({ words: cur, w: curW });
    lines.forEach((l, i) => { l.last = i === lines.length - 1; });
    return { lines, sp };
  }

  /* ---------- layout ---------- */
  function layout(v, cfg) {
    const ops = [], fs = cfg.fs, g = cfg.g, lh = fs * PT * cfg.lf, gap = fs * PT * 0.85 * g;
    const textW = PAGE_W - ML - MR;
    const text = (x, y, t, font, size) => ops.push({ k: "t", x, y, t, f: font, s: size });
    const center = (y, t, font, size, cx) => text((cx || PAGE_W / 2) - width(t, font, size) / 2, y, t, font, size);

    // header (fixed)
    ops.push({ k: "i", img: "flm", x: 16, y: 10, w: 30, h: 30 });
    ops.push({ k: "i", img: "za", x: PAGE_W - 16 - 30, y: 10, w: 30, h: 30 });
    HEADER.forEach((l, i) => center(18 + i * 5.4, l, "B", 12));
    let y = 42;

    // title (shrinks only if it is too wide)
    const title = String(v.title || "").trim().toUpperCase();
    if (title) {
      let ts = 15; while (ts > 10 && width(title, "T", ts) > textW) ts -= 0.5;
      y += 10 * g + ts * PT; center(y, title, "T", ts); y += 2;
    }

    // Antony (bold, wraps)
    if (String(v.antony || "").trim()) {
      y += 6 * g;
      const ws = words("**Antony: " + String(v.antony).trim().replace(/\*\*/g, "") + "**");
      const { lines, sp } = breakLines(ws, textW, textW, fs);
      lines.forEach(l => { y += lh; placeLine(ops, l, ML, y, textW, sp, fs, false); });
    }

    // blessing (fixed, centred, slightly larger)
    y += 6 * g;
    const bs = fs + 0.8;
    breakLines(words(BLESSING), 150, 150, bs).lines.forEach(l => {
      y += bs * PT * cfg.lf;
      const t = l.words.map(w => w.runs.map(r => r.t).join("")).join(" ");
      center(y, t, "R", bs);
    });

    // salutation
    if (String(v.salutation || "").trim()) { y += gap * 1.6 + lh; text(ML, y, String(v.salutation).trim(), "R", fs); }

    // body
    const bl = blocks(v.body);
    bl.forEach((b, i) => {
      y += (i === 0 && !String(v.salutation || "").trim()) ? gap * 1.6 : gap;
      if (b.kind === "bullet") {
        const ind = 12;
        const { lines, sp } = breakLines(b.words, textW - ind, textW - ind, fs);
        lines.forEach((l, j) => { y += lh; if (j === 0) text(ML + 5, y, "-", "R", fs); placeLine(ops, l, ML + ind, y, textW - ind, sp, fs, true); });
      } else {
        const ind = b.kind === "indent" ? 12.5 : 0;
        const { lines, sp } = breakLines(b.words, textW - ind, textW, fs);
        lines.forEach((l, j) => { y += lh; placeLine(ops, l, ML + (j === 0 ? ind : 0), y, textW - (j === 0 ? ind : 0), sp, fs, true); });
      }
    });

    // closing
    if (String(v.closing || "").trim()) { y += gap * 1.4 + lh; text(ML, y, String(v.closing).trim(), "R", fs); }

    // signature block, centred in the right part of the page
    const cx = 148;
    y += gap * 1.4 + lh;
    if (String(v.date || "").trim()) { center(y, String(v.date).trim(), "R", fs, cx); y += lh; }
    center(y, SIGN_TITLE, "R", fs, cx);
    y += Math.max(15, 24 * g);                       // room for the hand signature and stamp
    if (String(v.filoha || "").trim()) center(y, String(v.filoha).trim(), "B", fs, cx);
    y += fs * PT * 0.3;
    return { ops, bottom: y, cfg };
  }

  /* One line of words: justified unless it is the last line of the paragraph */
  function placeLine(ops, l, x0, y, maxW, sp, fs, justify) {
    const gaps = l.words.length - 1;
    const extra = justify && !l.last && gaps > 0 ? (maxW - l.w) / gaps : 0;
    let x = x0;
    l.words.forEach(w => {
      w.runs.forEach(r => { const f = r.b ? "B" : "R"; ops.push({ k: "t", x, y, t: r.t, f, s: fs }); x += width(r.t, f, fs); });
      x += sp + extra;
    });
  }

  /* Spacing is reduced first, then the font size */
  function fit(v) {
    const steps = [];
    [1, 0.85, 0.7, 0.55, 0.45].forEach(g => steps.push({ fs: 11, g, lf: 1.38 - (1 - g) * 0.3 }));
    for (let fs = 10.75; fs >= 8; fs -= 0.25) steps.push({ fs, g: 0.45, lf: 1.2 });
    let res = null;
    for (const cfg of steps) { res = layout(v, cfg); if (res.bottom <= BOTTOM) { res.fits = true; return res; } }
    res.fits = false; return res;
  }

  /* ---------- drawing ---------- */
  function drawCanvas(canvas, lay) {
    const cssW = canvas.clientWidth || 600, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssW * PAGE_H / PAGE_W * dpr);
    const k = canvas.width / PAGE_W, ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic";
    if ("fontKerning" in ctx) ctx.fontKerning = "none";
    lay.ops.forEach(o => {
      if (o.k === "i") ctx.drawImage(imgs[o.img].el, o.x * k, o.y * k, o.w * k, o.h * k);
      else { ctx.font = CSS_FONT[o.f].replace("{s}", (o.s * PT * k).toFixed(2)); ctx.fillText(o.t, o.x * k, o.y * k); }
    });
    if (!lay.fits) {   // show where the page ends
      ctx.strokeStyle = "#c62828"; ctx.setLineDash([6, 4]); ctx.beginPath();
      ctx.moveTo(0, BOTTOM * k); ctx.lineTo(canvas.width, BOTTOM * k); ctx.stroke();
    }
  }
  function makePdf(lay) {
    const doc = newDoc();
    doc.setTextColor(0, 0, 0);
    lay.ops.forEach(o => {
      if (o.k === "i") doc.addImage(imgs[o.img].data, "JPEG", o.x, o.y, o.w, o.h);
      else { doc.setFont(PDF_FONT[o.f][0], PDF_FONT[o.f][1]); doc.setFontSize(o.s); doc.text(o.t, o.x, o.y); }
    });
    return doc;
  }

  /* ---------- page ---------- */
  function todayText() { const d = new Date(); return "Toliara, faha-" + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function values(f) { const v = {}; ["title", "antony", "salutation", "body", "closing", "date", "filoha"].forEach(n => { v[n] = f.elements[n].value; }); return v; }
  function saveDraft(v) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch (e) { return null; } }
  function defaults() { return { title: "TARATASY FANASANA", antony: "", salutation: "Tompoko,", body: "", closing: "Mankasitraka indrindra.", date: todayText(), filoha }; }

  function formHTML(v) {
    const { t, esc } = Z();
    return `
      <div class="letter-grid">
        <form class="card form" id="f-letter">
          <div><label>${t("l.f_title")}</label><input name="title" maxlength="80" value="${esc(v.title)}"></div>
          <div><label>${t("l.f_antony")}</label><input name="antony" maxlength="200" value="${esc(v.antony)}"></div>
          <p class="hint letter-fixed">${t("l.fixed_blessing")}</p>
          <div><label>${t("l.f_salutation")}</label><input name="salutation" maxlength="80" value="${esc(v.salutation)}"></div>
          <div><label>${t("l.f_body")}</label>
            <div class="letter-tools">
              <button type="button" class="btn btn--outline btn--small" data-fmt="bold"><strong>B</strong> ${t("l.bold")}</button>
              <button type="button" class="btn btn--outline btn--small" data-fmt="list">– ${t("l.list")}</button>
              <button type="button" class="btn btn--outline btn--small" data-fmt="indent">⇥ ${t("l.indent")}</button>
            </div>
            <textarea name="body" rows="14" maxlength="6000">${esc(v.body)}</textarea>
            <p class="hint">${t("l.body_hint")}</p></div>
          <div><label>${t("l.f_closing")}</label><input name="closing" maxlength="80" value="${esc(v.closing)}"></div>
          <div class="row">
            <div><label>${t("l.f_date")}</label><input name="date" maxlength="80" value="${esc(v.date)}"></div>
            <div><label>${t("l.f_filoha")}</label><input name="filoha" maxlength="120" value="${esc(v.filoha)}"></div>
          </div>
          <p class="hint">${t("l.sign_fixed")}</p>
          <div id="l-fit" class="letter-fit"></div>
          <div class="inline">
            <button type="submit" class="btn btn--gold">⬇ ${t("l.download")}</button>
            <button type="button" class="btn btn--outline" data-new>${t("l.new")}</button>
          </div>
        </form>
        <div class="letter-preview">
          <div class="letter-preview__label">${t("l.preview")}</div>
          <canvas id="l-canvas"></canvas>
        </div>
      </div>`;
  }

  function update(f) {
    const { t } = Z();
    const v = values(f); saveDraft(v);
    lastLayout = fit(v);
    drawCanvas(document.getElementById("l-canvas"), lastLayout);
    const box = document.getElementById("l-fit");
    box.className = "letter-fit " + (lastLayout.fits ? "is-ok" : "is-err");
    box.textContent = lastLayout.fits
      ? t("l.fit_ok", { size: String(lastLayout.cfg.fs).replace(".", ",") })
      : t("l.fit_err");
    f.querySelector("button[type=submit]").disabled = !lastLayout.fits;
  }

  /* toolbar: bold around the selection, "- " or a tab at the start of the current line */
  function format(ta, kind) {
    const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    if (kind === "bold") {
      const sel = val.slice(s, e) || "…";
      ta.value = val.slice(0, s) + "**" + sel + "**" + val.slice(e);
      ta.setSelectionRange(s + 2, s + 2 + sel.length);
    } else {
      const ls = val.lastIndexOf("\n", s - 1) + 1, pre = kind === "list" ? "- " : "\t";
      const line = val.slice(ls);
      if (line.startsWith(pre)) { ta.value = val.slice(0, ls) + line.slice(pre.length); ta.setSelectionRange(Math.max(ls, s - pre.length), Math.max(ls, s - pre.length)); }
      else { ta.value = val.slice(0, ls) + pre + line.replace(/^(- |\t)/, ""); ta.setSelectionRange(s + pre.length, s + pre.length); }
    }
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fileName(v) {
    const d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const slug = String(v.antony || v.title || "taratasy").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "taratasy";
    return "Taratasy_" + slug + "_" + iso + ".pdf";
  }

  function bind(root) {
    const f = root.querySelector("#f-letter");
    let timer = null;
    f.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => update(f), 250); });
    f.addEventListener("submit", e => {
      e.preventDefault();
      update(f);
      if (!lastLayout.fits) return;
      makePdf(lastLayout).save(fileName(values(f)));
    });
    root.querySelectorAll("[data-fmt]").forEach(b => b.addEventListener("click", () => format(f.elements.body, b.dataset.fmt)));
    root.querySelector("[data-new]").addEventListener("click", () => {
      if (f.elements.body.value.trim() && !confirm(Z().t("l.new_confirm"))) return;
      const d = defaults(); Object.keys(d).forEach(k => { f.elements[k].value = d[k]; }); update(f);
    });
    let rt = null;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => lastLayout && drawCanvas(document.getElementById("l-canvas"), lastLayout), 200); });
  }

  /* who may open the page: same session as the members' page or the phone app */
  function readToken() {
    try { const s = sessionStorage.getItem("za_token"); if (s) return s; } catch (e) { /* ignore */ }
    try { return JSON.parse(localStorage.getItem("za_dev_token")); } catch (e) { return null; }
  }
  async function access() {
    const CFG = window.SITE_CONFIG || {};
    if (!CFG.API_URL) return { ok: true, filoha: "", demo: true };
    const token = readToken();
    if (!token) return { ok: false, error: "login" };
    try {
      const res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "letter_info", token }) });
      const r = await res.json();
      if (r.ok) return r;
      return { ok: false, error: r.error === "forbidden" ? "forbidden" : "login" };
    } catch (e) { return { ok: false, error: "offline" }; }
  }

  window.renderLetterPage = async function () {
    if (ready) return;
    const root = document.getElementById("letter-app");
    if (!root || !Z()) return;
    ready = true;
    const { t } = Z();
    const acc = await access();
    if (!acc.ok) {
      const k = { login: "l.need_login", forbidden: "l.no_right", offline: "l.offline" }[acc.error] || "m.error";
      root.innerHTML = `<div class="card"><p>${t(k)}</p>${acc.error === "login" ? `<a class="btn btn--gold" href="mpikambana.html">${t("nav.members")}</a>` : ""}</div>`;
      return;
    }
    filoha = acc.filoha || "";
    try {
      [fonts, imgs] = await Promise.all([loadFonts(), Promise.all([loadImg("assets/img/letter-flm.jpg"), loadImg("assets/img/letter-za.jpg")]).then(a => ({ flm: a[0], za: a[1] }))]);
      measureDoc = newDoc();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="card"><p>${t("l.load_err")}</p></div>`; return;
    }
    const draft = readDraft(), d = defaults();
    const v = draft ? Object.assign({}, d, draft, { date: d.date, filoha: draft.filoha || d.filoha }) : d;
    root.innerHTML = (acc.demo ? `<p class="demo-note">${t("l.demo")}</p>` : "") + formHTML(v);
    bind(root);
    update(root.querySelector("#f-letter"));
  };

  /* exposed for tests */
  window.ZALetter = { fit, blocks, todayText };
})();
