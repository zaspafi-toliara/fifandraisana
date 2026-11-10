/* ==========================================================================
   ZA SPaFI Toliara – Google Apps Script back end
   --------------------------------------------------------------------------
   The Google Sheet is the database. This script:
     1. creates the tabs (menu "ZA SPaFI" > "Hamorona ny takelaka")
     2. fills missing member IDs and PINs
     3. serves the website (web app): public data, donation declarations,
        members' login and members' dashboard, marking tasks as done.
   Deploy: Deploy > New deployment > Web app
           Execute as: Me   |   Who has access: Anyone
   Paste the web-app URL in assets/js/config.js (API_URL).
   ========================================================================== */

/* ---------- Sheet structure ---------- */
const S = {
  members: {
    name: "Mpikambana",
    headers: ["ID", "Anarana feno", "Daty nahaterahana", "Finday", "Vaomiera", "Birao",
              "Andraikitra Birao", "Daty niditra", "Sata", "Zo", "PIN"],
    widths:  [80, 220, 130, 130, 150, 70, 170, 110, 110, 130, 70]
  },
  fees: {
    name: "Latsakemboka",
    headers: ["Daty naloa", "ID mpikambana", "Volana", "Vola", "Nampiditra", "Fanamarihana"],
    widths:  [110, 120, 90, 100, 130, 220]
  },
  transactions: {
    name: "Vola",
    headers: ["Daty", "Karazany", "Vola", "Antony", "Sokajy", "Nampiditra"],
    widths:  [110, 100, 110, 300, 150, 130]
  },
  donations: {
    name: "Fanomezana",
    headers: ["Voaray tamin'ny", "Daty nandefasana", "Anarana", "Finday", "Vola", "Tambajotra",
              "Référence", "Aseho anarana", "Hafatra", "Sata", "Daty voamarina"],
    widths:  [150, 120, 200, 130, 100, 120, 150, 110, 250, 110, 120]
  },
  materials: {
    name: "Fitaovana",
    headers: ["ID", "Karazany", "Famaritana", "Habe", "Toetra"],
    widths:  [90, 130, 260, 70, 120]
  },
  loans: {
    name: "Fampindramana",
    headers: ["Daty nindramana", "ID fitaovana", "ID mpikambana", "Daty naverina", "Fanamarihana"],
    widths:  [130, 110, 120, 120, 250]
  },
  goals: {
    name: "Tanjona",
    headers: ["ID", "Lohateny", "Famaritana", "Fe-potoana", "Aseho"],
    widths:  [70, 280, 380, 110, 80]
  },
  tasks: {
    name: "Asa",
    headers: ["ID", "ID tanjona", "Asa", "Tompon'andraikitra", "Fe-potoana", "Sata", "Daty vita", "Fanamarihana"],
    widths:  [70, 90, 300, 170, 110, 170, 110, 220]
  },
  attendance: {
    name: "Fanatrehana",
    headers: ["Daty", "ID mpikambana", "Fotoana"],
    widths:  [110, 120, 200]
  },
  settings: {
    name: "Fikirana",
    headers: ["Fikirana", "Sanda", "Fanazavana"],
    widths:  [260, 120, 420]
  }
};

/* Allowed values (drop-down lists) */
const V = {
  yesNo: ["Eny", "Tsia"],
  memberStatus: ["Mavitrika", "Tsy mavitrika"],
  rights: ["Mpikambana", "Sekretera", "Mpitahiry vola", "Mpandrindra"],
  commissions: ["Soratra Masina", "Fifandraisana", "Fitaovana", "Fampandrosoana", "Hira sy mozika"],
  officeRoles: ["Filoha", "Filoha lefitra", "Sekretera voalohany", "Sekretera faharoa", "Mpitahiry vola", "Mpanolon-tsaina"],
  txType: ["Miditra", "Mivoaka"],
  donationStatus: ["Miandry", "Voamarina", "Nolavina"],
  taskStatus: ["Hatao", "Eo am-panatanterahana", "Vita"],
  operators: ["MVola", "Orange Money", "Airtel Money", "Hafa"]
};
const TASK_CODE = { "Hatao": "todo", "Eo am-panatanterahana": "in_progress", "Vita": "done" };

const DEFAULT_SETTINGS = [
  ["Latsakemboka isam-bolana", 2000, "Vola aloan'ny mpikambana tsirairay isam-bolana (Ariary)"],
  ["Daty farany handoavana", 10, "Andro amin'ny volana manaraka: aloa alohan'ny/amin'ny io andro io = ara-potoana"],
  ["Vola tany am-boalohany", 0, "Vola teo am-pelatanana talohan'ny nanombohana ny rakitra (Ariary)"],
  ["Fampahatsiahivana (andro mialoha)", 3, "Andro alohan'ny fe-potoana handefasana fampahatsiahivana (dingana 3)"]
];

const TZ = "Indian/Antananarivo";
const SESSION_SECONDS = 6 * 60 * 60;   // 6 hours

/* ==========================================================================
   Menu and setup
   ========================================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("ZA SPaFI")
    .addItem("Hamorona ny takelaka (setup)", "setup")
    .addItem("Hameno ID sy PIN tsy ampy", "fillIdsAndPins")
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(S).forEach(k => {
    const def = S[k];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      .setFontWeight("bold").setBackground("#1b3a8a").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    def.widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  });

  const rows = 2000;
  const dd = (sheetKey, header, list) => {
    const sh = ss.getSheetByName(S[sheetKey].name);
    const col = S[sheetKey].headers.indexOf(header) + 1;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
    sh.getRange(2, col, rows, 1).setDataValidation(rule);
  };
  const dateCol = (sheetKey, header) => {
    const sh = ss.getSheetByName(S[sheetKey].name);
    const col = S[sheetKey].headers.indexOf(header) + 1;
    sh.getRange(2, col, rows, 1).setNumberFormat("yyyy-mm-dd");
  };
  const textCol = (sheetKey, header) => {
    const sh = ss.getSheetByName(S[sheetKey].name);
    const col = S[sheetKey].headers.indexOf(header) + 1;
    sh.getRange(2, col, rows, 1).setNumberFormat("@");
  };

  dd("members", "Vaomiera", V.commissions);
  dd("members", "Birao", V.yesNo);
  dd("members", "Andraikitra Birao", V.officeRoles);
  dd("members", "Sata", V.memberStatus);
  dd("members", "Zo", V.rights);
  dateCol("members", "Daty nahaterahana"); dateCol("members", "Daty niditra");
  textCol("members", "Finday"); textCol("members", "PIN");

  dateCol("fees", "Daty naloa"); textCol("fees", "Volana");
  dd("transactions", "Karazany", V.txType); dateCol("transactions", "Daty");
  dd("donations", "Sata", V.donationStatus); dd("donations", "Aseho anarana", V.yesNo);
  dd("donations", "Tambajotra", V.operators);
  dateCol("donations", "Daty nandefasana"); dateCol("donations", "Daty voamarina"); textCol("donations", "Finday");
  dateCol("loans", "Daty nindramana"); dateCol("loans", "Daty naverina");
  dd("goals", "Aseho", V.yesNo); dateCol("goals", "Fe-potoana");
  dd("tasks", "Sata", V.taskStatus); dateCol("tasks", "Fe-potoana"); dateCol("tasks", "Daty vita");
  dateCol("attendance", "Daty");

  // "Tompon'andraikitra" accepts a member ID (ZA-001) or a commission name: no strict list.
  const setSh = ss.getSheetByName(S.settings.name);
  if (setSh.getLastRow() < 2) setSh.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);

  // remove the empty default sheet if present
  const def = ss.getSheetByName("Sheet1") || ss.getSheetByName("Feuille 1") || ss.getSheetByName("Feuille1");
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  SpreadsheetApp.getActive().toast("Vita ny fanomanana ny takelaka.", "ZA SPaFI", 5);
}

/* Gives an ID (ZA-001…) and a 4-digit PIN to members who have none */
function fillIdsAndPins() {
  const sh = sheet_("members");
  const data = sh.getDataRange().getValues();
  const h = data[0];
  const cId = h.indexOf("ID"), cName = h.indexOf("Anarana feno"), cPin = h.indexOf("PIN");
  let max = 0;
  data.slice(1).forEach(r => {
    const m = String(r[cId]).match(/ZA-(\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  let n = 0;
  for (let i = 1; i < data.length; i++) {
    if (!String(data[i][cName]).trim()) continue;
    if (!String(data[i][cId]).trim()) {
      max++; sh.getRange(i + 1, cId + 1).setValue("ZA-" + ("00" + max).slice(-3)); n++;
    }
    if (!String(data[i][cPin]).trim()) {
      sh.getRange(i + 1, cPin + 1).setValue(String(Math.floor(1000 + Math.random() * 9000))); n++;
    }
  }
  SpreadsheetApp.getActive().toast(n + " sela nofenoina.", "ZA SPaFI", 5);
}

/* ==========================================================================
   Web app entry points
   ========================================================================== */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "public";
  try {
    if (action === "public") return json_(publicData_());
    return json_({ ok: false, error: "unknown_action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || "{}"); }
  catch (err) { return json_({ ok: false, error: "bad_json" }); }
  try {
    switch (body.action) {
      case "donation":    return json_(addDonation_(body));
      case "login":       return json_(login_(body));
      case "me":          return json_(withMember_(body, me_));
      case "finance_all": return json_(withMember_(body, financeAll_));
      case "task_done":   return json_(withMember_(body, taskDone_));
      case "logout":      CacheService.getScriptCache().remove("tok_" + body.token); return json_({ ok: true });
      default:            return json_({ ok: false, error: "unknown_action" });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ==========================================================================
   Public data
   ========================================================================== */
function publicData_() {
  const goals = rows_("goals").filter(g => g["ID"] && g["Aseho"] !== "Tsia");
  const tasks = rows_("tasks");
  const outGoals = goals.map(g => {
    const steps = tasks.filter(t => String(t["ID tanjona"]) === String(g["ID"]) && t["Asa"])
      .sort((a, b) => iso_(a["Fe-potoana"]) < iso_(b["Fe-potoana"]) ? -1 : 1)
      .map(t => {
        const status = TASK_CODE[t["Sata"]] || "todo";
        return { title: t["Asa"], status, date: status === "done" ? (iso_(t["Daty vita"]) || iso_(t["Fe-potoana"])) : iso_(t["Fe-potoana"]) };
      });
    return { id: g["ID"], title: g["Lohateny"], description: g["Famaritana"], target_date: iso_(g["Fe-potoana"]), steps };
  });

  const donations = rows_("donations").filter(d => d["Sata"] === "Voamarina")
    .map(d => ({ date: iso_(d["Daty nandefasana"]) || iso_(d["Voaray tamin'ny"]),
                 name: d["Aseho anarana"] === "Eny" ? d["Anarana"] : null,
                 amount: num_(d["Vola"]) }));

  const order = V.officeRoles;
  const office = rows_("members")
    .filter(m => m["Birao"] === "Eny" && m["Sata"] !== "Tsy mavitrika" && m["Anarana feno"])
    .map(m => ({ role: m["Andraikitra Birao"] || "", name: m["Anarana feno"] }))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  return { ok: true, sample: false, updated: iso_(new Date()), goals: outGoals, donations, office };
}

function addDonation_(b) {
  const amount = num_(b.amount);
  if (!b.name || !b.reference || !b.phone || !(amount > 0)) return { ok: false, error: "missing_fields" };
  // prevent text starting with = + - @ from being read as a formula
  const clip = (s, n) => { const t = String(s || "").slice(0, n); return /^[=+\-@]/.test(t) ? "'" + t : t; };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    sheet_("donations").appendRow([
      new Date(), b.date ? new Date(b.date + "T00:00:00") : "", clip(b.name, 120), "'" + clip(b.phone, 30),
      amount, clip(b.operator, 30), clip(b.reference, 60), b.show_name ? "Eny" : "Tsia",
      clip(b.message, 500), "Miandry", ""
    ]);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/* ==========================================================================
   Members: login and session
   ========================================================================== */
function login_(b) {
  const ident = String(b.identifier || "").trim();
  const pin = String(b.pin || "").trim();
  if (!ident || !pin) return { ok: false, error: "missing_fields" };

  const cache = CacheService.getScriptCache();
  const failKey = "fail_" + ident.toUpperCase().replace(/\s/g, "");
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { ok: false, error: "locked" };

  const m = findMember_(ident);
  if (!m || String(m["PIN"]).trim() !== pin || m["Sata"] === "Tsy mavitrika") {
    cache.put(failKey, String(fails + 1), 15 * 60);
    return { ok: false, error: "bad_credentials" };
  }
  cache.remove(failKey);
  const token = Utilities.getUuid();
  cache.put("tok_" + token, String(m["ID"]), SESSION_SECONDS);
  return { ok: true, token };
}

function findMember_(ident) {
  const up = ident.toUpperCase().replace(/\s/g, "");
  const digits = ident.replace(/\D/g, "").slice(-9);
  return rows_("members").find(m => {
    if (String(m["ID"]).toUpperCase() === up) return true;
    const p = String(m["Finday"]).replace(/\D/g, "").slice(-9);
    return digits.length === 9 && p === digits;
  });
}

function withMember_(b, fn) {
  const id = CacheService.getScriptCache().get("tok_" + b.token);
  if (!id) return { ok: false, error: "session_expired" };
  const m = rows_("members").find(r => String(r["ID"]) === id);
  if (!m) return { ok: false, error: "session_expired" };
  return fn(m, b);
}

function isOffice_(m) { return m["Birao"] === "Eny" || m["Zo"] === "Mpandrindra"; }

/* ==========================================================================
   Members: dashboard data
   ========================================================================== */
function me_(m) {
  const now = new Date();
  const year = now.getFullYear();
  const set = settings_();
  const members = rows_("members");
  const feeRows = rows_("fees");
  const nameOf = id => { const x = members.find(r => String(r["ID"]) === String(id)); return x ? x["Anarana feno"] : id; };

  /* --- my fees for the current year --- */
  const months = feeMonths_(m, feeRows, year, set);

  /* --- my loans --- */
  const mats = rows_("materials");
  const loans = rows_("loans").filter(l => String(l["ID mpikambana"]) === String(m["ID"]))
    .map(l => {
      const mat = mats.find(x => String(x["ID"]) === String(l["ID fitaovana"])) || {};
      return { material_id: l["ID fitaovana"], type: mat["Karazany"] || "", desc: mat["Famaritana"] || "",
               date: iso_(l["Daty nindramana"]), returned: !!l["Daty naverina"], return_date: iso_(l["Daty naverina"]) };
    })
    .sort((a, b) => (a.returned === b.returned ? (a.date < b.date ? 1 : -1) : a.returned ? 1 : -1));

  /* --- tasks --- */
  const goals = rows_("goals");
  const tasks = rows_("tasks").filter(t => t["Asa"]).map(t => {
    const who = String(t["Tompon'andraikitra"] || "");
    const g = goals.find(x => String(x["ID"]) === String(t["ID tanjona"]));
    return {
      id: t["ID"], goal: g ? g["Lohateny"] : "", title: t["Asa"],
      assignee: who, assignee_label: /^ZA-\d+$/i.test(who) ? nameOf(who) : who,
      due: iso_(t["Fe-potoana"]), status: TASK_CODE[t["Sata"]] || "todo", done_date: iso_(t["Daty vita"]),
      mine: canEditTask_(m, who, false), can_edit: canEditTask_(m, who, true)
    };
  }).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  /* --- rankings (current year) --- */
  const active = members.filter(r => r["ID"] && r["Sata"] !== "Tsy mavitrika");
  const feeTop = active.map(r => ({ name: r["Anarana feno"],
      count: feeMonths_(r, feeRows, year, set).filter(x => x.on_time).length }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  const att = rows_("attendance").filter(a => a["Daty"] instanceof Date && a["Daty"].getFullYear() === year);
  const attTop = active.map(r => ({ name: r["Anarana feno"],
      count: att.filter(a => String(a["ID mpikambana"]) === String(r["ID"])).length }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);

  const out = {
    ok: true,
    member: { id: m["ID"], name: m["Anarana feno"], commission: m["Vaomiera"], office_role: m["Andraikitra Birao"] || "",
              is_office: isOffice_(m) },
    fees: { year, monthly_amount: set.monthly, months },
    loans, tasks,
    top: { fees: feeTop, attendance: attTop },
    finance: financeSummary_(10)
  };

  /* --- office only: everyone's fees --- */
  if (isOffice_(m)) {
    out.fees_all = active.map(r => ({ id: r["ID"], name: r["Anarana feno"],
      months: feeMonths_(r, feeRows, year, set).map(x => x.paid ? (x.on_time ? "on_time" : "late")
                                                      : x.not_member ? "na" : x.future ? "future" : "unpaid") }));
  }
  return out;
}

function feeMonths_(m, feeRows, year, set) {
  const now = new Date();
  const joined = m["Daty niditra"] instanceof Date ? m["Daty niditra"] : null;
  const mine = feeRows.filter(f => String(f["ID mpikambana"]) === String(m["ID"]));
  const res = [];
  for (let mo = 1; mo <= 12; mo++) {
    const key = year + "-" + ("0" + mo).slice(-2);
    const f = mine.find(x => monthKey_(x["Volana"]) === key);
    const beforeJoin = joined && (joined.getFullYear() > year || (joined.getFullYear() === year && joined.getMonth() + 1 > mo));
    const deadline = new Date(year, mo, set.deadlineDay, 23, 59, 59);   // day X of the following month
    const future = now <= deadline;                                       // not yet due
    let onTime = false;
    if (f && f["Daty naloa"] instanceof Date) {
      onTime = f["Daty naloa"] <= deadline;
    } else if (f) onTime = true;
    res.push({ month: key, paid: !!f, on_time: !!f && onTime, date: f ? iso_(f["Daty naloa"]) : "",
               amount: f ? num_(f["Vola"]) : 0, future, not_member: !!beforeJoin });
  }
  return res;
}

function financeSummary_(limit) {
  const set = settings_();
  const tx = rows_("transactions").filter(t => t["Vola"] !== "" && t["Karazany"]);
  const don = rows_("donations").filter(d => d["Sata"] === "Voamarina");
  const fees = rows_("fees").filter(f => f["Vola"] !== "");
  const income = tx.filter(t => t["Karazany"] === "Miditra").reduce((s, t) => s + num_(t["Vola"]), 0);
  const expense = tx.filter(t => t["Karazany"] === "Mivoaka").reduce((s, t) => s + num_(t["Vola"]), 0);
  const donations = don.reduce((s, d) => s + num_(d["Vola"]), 0);
  const feeTotal = fees.reduce((s, f) => s + num_(f["Vola"]), 0);

  const list = tx.map(t => ({ date: iso_(t["Daty"]), type: t["Karazany"] === "Miditra" ? "in" : "out",
                              amount: num_(t["Vola"]), reason: t["Antony"], category: t["Sokajy"] || "" }))
    .concat(don.map(d => ({ date: iso_(d["Daty nandefasana"]) || iso_(d["Voaray tamin'ny"]), type: "in",
                            amount: num_(d["Vola"]), reason: "Fanomezana", category: "donation" })))
    .concat(fees.map(f => ({ date: iso_(f["Daty naloa"]), type: "in", amount: num_(f["Vola"]),
                             reason: "Latsakemboka " + monthKey_(f["Volana"]), category: "fee" })))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    opening: set.opening, income: income + donations + feeTotal, expense, donations, fees: feeTotal,
    balance: set.opening + income + donations + feeTotal - expense,
    total_count: list.length,
    recent: limit ? list.slice(0, limit) : list
  };
}

function financeAll_(m) { return { ok: true, finance: financeSummary_(0) }; }

function canEditTask_(m, who, allowOffice) {
  who = String(who || "").trim().toLowerCase();
  if (!who) return allowOffice && isOffice_(m);
  if (who === String(m["ID"]).toLowerCase()) return true;
  if (m["Vaomiera"] && who === String(m["Vaomiera"]).toLowerCase()) return true;
  return allowOffice && isOffice_(m);
}

function taskDone_(m, b) {
  const sh = sheet_("tasks");
  const data = sh.getDataRange().getValues();
  const h = data[0];
  const cId = h.indexOf("ID"), cWho = h.indexOf("Tompon'andraikitra"), cSt = h.indexOf("Sata"), cDone = h.indexOf("Daty vita");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cId]) === String(b.task_id)) {
      if (!canEditTask_(m, data[i][cWho], true)) return { ok: false, error: "forbidden" };
      sh.getRange(i + 1, cSt + 1).setValue("Vita");
      sh.getRange(i + 1, cDone + 1).setValue(new Date());
      return { ok: true };
    }
  }
  return { ok: false, error: "not_found" };
}

/* ==========================================================================
   Helpers
   ========================================================================== */
function sheet_(key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(S[key].name);
  if (!sh) throw new Error("Missing sheet: " + S[key].name + " (run setup)");
  return sh;
}

/* Rows as objects keyed by header; empty rows skipped */
function rows_(key) {
  const values = sheet_(key).getDataRange().getValues();
  const h = values.shift() || [];
  return values.filter(r => r.some(c => c !== "" && c !== null))
    .map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; });
}

function settings_() {
  const map = {};
  rows_("settings").forEach(r => { map[r["Fikirana"]] = r["Sanda"]; });
  return {
    monthly: num_(map["Latsakemboka isam-bolana"]) || 0,
    deadlineDay: num_(map["Daty farany handoavana"]) || 10,
    opening: num_(map["Vola tany am-boalohany"]) || 0,
    reminderDays: num_(map["Fampahatsiahivana (andro mialoha)"]) || 3
  };
}

function iso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return v ? String(v).slice(0, 10) : "";
}
function monthKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM");
  return String(v || "").trim().slice(0, 7);
}
function num_(v) { return Number(String(v).replace(/[^\d.-]/g, "")) || 0; }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
