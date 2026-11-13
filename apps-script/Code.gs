/* ==========================================================================
   ZA SPaFi Toliara – Google Apps Script back end
   --------------------------------------------------------------------------
   The Google Sheet is the database. This script:
     1. creates the tabs (menu "ZA SPaFi" > "Hamorona ny takelaka")
     2. fills missing member IDs and PINs
     3. serves the website (web app): public data, donation declarations,
        members' login and members' dashboard, marking tasks as done.
     4. serves the phone entry app (fampidirana.html): QR scans, fees,
        transactions, loans, attendance, donation confirmation (offline queue).
     5. sends SMS task reminders through "SMS Gateway for Android" (daily trigger).
   Deploy: Deploy > New deployment > Web app
           Execute as: Me   |   Who has access: Anyone
   Paste the web-app URL in assets/js/config.js (API_URL).
   ========================================================================== */

/* ---------- Sheet structure ---------- */
const S = {
  members: {
    name: "Mpikambana",
    headers: ["ID", "Anarana feno", "Daty nahaterahana", "Finday", "Vaomiera", "Birao",
              "Andraikitra Birao", "Daty niditra", "Sata", "Zo", "PIN", "Sary", "Sokajy"],
    widths:  [80, 220, 130, 130, 150, 70, 170, 110, 110, 130, 70, 160, 110]
  },
  fees: {
    name: "Latsakemboka",
    headers: ["Daty naloa", "ID mpikambana", "Volana", "Vola", "Nampiditra", "Fanamarihana", "Sata", "ID"],
    widths:  [110, 120, 90, 100, 130, 220, 110, 130]
  },
  transactions: {
    name: "Vola",
    headers: ["Daty", "Karazany", "Vola", "Antony", "Sokajy", "Nampiditra", "Sata", "ID"],
    widths:  [110, 100, 110, 300, 150, 130, 110, 160]
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
    headers: ["ID", "ID tanjona", "Asa", "Tompon'andraikitra", "Fe-potoana", "Sata", "Daty vita", "Fanamarihana", "Aseho", "Vaomiera"],
    widths:  [70, 90, 300, 170, 110, 170, 110, 220, 80, 150]
  },
  attendance: {
    name: "Fanatrehana",
    headers: ["Daty", "ID mpikambana", "Ora tonga"],
    widths:  [110, 120, 200]
  },
  invitations: {
    name: "Fanasana",
    headers: ["Voaray tamin'ny", "Anarana", "Fikambanana / vondrona", "Finday", "Mailaka", "Lohahevitra", "Taratasy", "Sata", "Fanamarihana"],
    widths:  [150, 200, 220, 130, 200, 320, 260, 120, 260]
  },
  log: {
    name: "Tantara",
    headers: ["Daty", "Nampiditra", "Asa", "Antsipiriany", "op_id"],
    widths:  [150, 180, 140, 420, 260]
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
  feeCategory: ["Mpianatra", "Miasa"],
  rights: ["Mpikambana", "Sekretera", "Mpitahiry vola", "Mpandrindra", "Mpandray fahatongavana"],
  txStatus: ["Voamarina", "Miandry", "Nolavina"],
  invitationStatus: ["Vaovao", "Eken'ny Birao", "Nolavina", "Vita"],
  commissions: ["Soratra Masina", "Fifandraisana", "Fitaovana", "Fampandrosoana", "Hira sy mozika"],
  officeRoles: ["Filoha", "Filoha lefitra", "Sekretera voalohany", "Sekretera faharoa", "Mpitahiry vola", "Mpanolon-tsaina"],
  txType: ["Miditra", "Mivoaka"],
  donationStatus: ["Miandry", "Voamarina", "Nolavina"],
  taskStatus: ["Hatao", "Eo am-panatanterahana", "Vita"],
  operators: ["MVola", "Orange Money", "Airtel Money", "Hafa"]
};
const TASK_CODE = { "Hatao": "todo", "Eo am-panatanterahana": "in_progress", "Vita": "done" };

const DEFAULT_SETTINGS = [
  ["Latsakemboka isam-bolana", 2000, "Raha tsy voafaritra ny Sokajy an'ilay mpikambana (Ariary)"],
  ["Latsakemboka mpianatra", 1000, "Latsakemboka isam-bolana ho an'ny Sokajy = Mpianatra (Ariary)"],
  ["Latsakemboka miasa", 2000, "Latsakemboka isam-bolana ho an'ny Sokajy = Miasa (Ariary)"],
  ["Daty farany handoavana", 10, "Andro amin'ny volana manaraka: aloa alohan'ny/amin'ny io andro io = ara-potoana"],
  ["Vola tany am-boalohany", 0, "Vola teo am-pelatanana talohan'ny nanombohana ny rakitra (Ariary)"],
  ["Fampahatsiahivana (andro mialoha)", 3, "Andro alohan'ny fe-potoana handefasana fampahatsiahivana (dingana 3)"],
  ["Ora fiandohan'ny fivoriana", "14:00", "Ora anombohan'ny fivoriana (oh: 14:00). Tonga aorian'io + fahatarana azo leferina = tara"],
  ["Fahatarana azo leferina (minitra)", 10, "Minitra azo leferina aorian'ny ora fiandohana"],
  ["Fifandraisana mandray fanasana (ID)", "", "ID an'ilay mpikambana amin'ny Vaomiera Fifandraisana handray SMS isaky ny fanasana vaovao (oh: ZA-005)"],
  ["Mailaka fikambanana", "zaspafi.toliara601@gmail.com", "Adiresy handefasana mailaka isaky ny fanasana vaovao"]
];
/* Fee year of the association: October → August (no fee in September) */
const FEE_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

const TZ = "Indian/Antananarivo";
const SESSION_SECONDS = 6 * 60 * 60;   // 6 hours (members' area)
const DEVICE_DAYS = 30;                 // "remember this phone" for the entry app (staff only)
const STAFF_RIGHTS = ["Sekretera", "Mpitahiry vola", "Mpandrindra"];

/* ==========================================================================
   Menu and setup
   ========================================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("ZA SPaFi")
    .addItem("Hamorona ny takelaka (setup)", "setup")
    .addItem("Hameno ID sy PIN tsy ampy", "fillIdsAndPins")
    .addSeparator()
    .addItem("SMS: ampidiro ny kaonty SMS Gateway", "smsSetCredentials")
    .addItem("SMS: andramo (alefa SMS iray)", "smsTest")
    .addItem("SMS: alefaso isan'andro ny fampahatsiahivana", "installReminderTrigger")
    .addItem("SMS: ajanony ny fampahatsiahivana", "removeReminderTrigger")
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
  dd("members", "Sokajy", V.feeCategory);
  dateCol("members", "Daty nahaterahana"); dateCol("members", "Daty niditra");
  textCol("members", "Finday"); textCol("members", "PIN");

  dateCol("fees", "Daty naloa"); textCol("fees", "Volana"); dd("fees", "Sata", V.txStatus);
  dd("transactions", "Karazany", V.txType); dd("transactions", "Sata", V.txStatus); dateCol("transactions", "Daty");
  dd("donations", "Sata", V.donationStatus); dd("donations", "Aseho anarana", V.yesNo);
  dd("donations", "Tambajotra", V.operators);
  dateCol("donations", "Daty nandefasana"); dateCol("donations", "Daty voamarina"); textCol("donations", "Finday");
  dateCol("loans", "Daty nindramana"); dateCol("loans", "Daty naverina");
  dd("goals", "Aseho", V.yesNo); dateCol("goals", "Fe-potoana");
  dd("tasks", "Sata", V.taskStatus); dd("tasks", "Aseho", V.yesNo); dd("tasks", "Vaomiera", V.commissions); dateCol("tasks", "Fe-potoana"); dateCol("tasks", "Daty vita");
  dateCol("attendance", "Daty");
  // arrival time column: free text "HH:mm" (the old meeting-type list is removed)
  const attSh = ss.getSheetByName(S.attendance.name);
  attSh.getRange(2, 3, rows, 1).clearDataValidations().setNumberFormat("@");
  dateCol("log", "Daty");
  dd("invitations", "Sata", V.invitationStatus); textCol("invitations", "Finday");

  // "Tompon'andraikitra" accepts a member ID (ZA-001) or a commission name: no strict list.
  const setSh = ss.getSheetByName(S.settings.name);
  // add the settings that are missing (keeps the values already typed)
  const have = setSh.getLastRow() > 1 ? setSh.getRange(2, 1, setSh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  DEFAULT_SETTINGS.filter(d => have.indexOf(d[0]) < 0).forEach(d => {
    setSh.appendRow(d[0] === "Ora fiandohan'ny fivoriana" ? [d[0], "'" + d[1], d[2]] : d);
  });

  // remove the empty default sheet if present
  const def = ss.getSheetByName("Sheet1") || ss.getSheetByName("Feuille 1") || ss.getSheetByName("Feuille1");
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  SpreadsheetApp.getActive().toast("Vita ny fanomanana ny takelaka.", "ZA SPaFi", 5);
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
  SpreadsheetApp.getActive().toast(n + " sela nofenoina.", "ZA SPaFi", 5);
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
      case "add_task":    return json_(withMember_(body, addTask_));
      case "add_goal":    return json_(withMember_(body, addGoal_));
      case "broadcast":   return json_(withMember_(body, broadcast_));
      case "notify_task": return json_(withMember_(body, notifyTask_));
      case "notify_materials": return json_(withMember_(body, notifyMaterials_));
      case "invite":      return json_(addInvitation_(body));
      case "add_member":  return json_(withMember_(body, addMember_));
      case "staff_lists": return json_(withMember_(body, staffLists_));
      case "sync":        return json_(withMember_(body, sync_));
      case "my_photo":    return json_(withMember_(body, (m, b) => {
                            const id = savePhoto_(m["ID"], b.image);
                            return id ? { ok: true, photo: id } : { ok: false, error: "bad_image" };
                          }));
      case "logout":      logout_(body.token); return json_({ ok: true });
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
    const steps = tasks.filter(t => String(t["ID tanjona"]) === String(g["ID"]) && t["Asa"] && t["Aseho"] !== "Tsia")
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
  if (!m || String(m["PIN"]).replace(/^'/, "").trim() !== pin || m["Sata"] === "Tsy mavitrika") {
    cache.put(failKey, String(fails + 1), 15 * 60);
    return { ok: false, error: "bad_credentials" };
  }
  cache.remove(failKey);
  const token = Utilities.getUuid();
  if (b.remember) {
    // long session for the entry app, only for people allowed to enter data
    if (!canAny_(m)) return { ok: false, error: "not_staff" };
    PropertiesService.getScriptProperties().setProperty("dev_" + token,
      JSON.stringify({ id: String(m["ID"]), exp: Date.now() + DEVICE_DAYS * 86400000 }));
  } else {
    cache.put("tok_" + token, String(m["ID"]), SESSION_SECONDS);
  }
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
  let id = b.token ? CacheService.getScriptCache().get("tok_" + b.token) : null;
  if (!id && b.token) {
    const raw = PropertiesService.getScriptProperties().getProperty("dev_" + b.token);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.exp > Date.now()) id = d.id;
      else PropertiesService.getScriptProperties().deleteProperty("dev_" + b.token);
    }
  }
  if (!id) return { ok: false, error: "session_expired" };
  const m = rows_("members").find(r => String(r["ID"]) === id);
  if (!m) return { ok: false, error: "session_expired" };
  return fn(m, b);
}

function logout_(token) {
  if (!token) return;
  CacheService.getScriptCache().remove("tok_" + token);
  PropertiesService.getScriptProperties().deleteProperty("dev_" + token);
}

function isOffice_(m) { return m["Birao"] === "Eny" || m["Zo"] === "Mpandrindra"; }

/* What a person may enter in the phone app */
function isTreasurer_(m) { return m["Zo"] === "Mpitahiry vola" || m["Andraikitra Birao"] === "Mpitahiry vola"; }
function isSecretary_(m) { return m["Zo"] === "Sekretera" || /^Sekretera/.test(String(m["Andraikitra Birao"] || "")); }

/* Who may do what (phone entry app, cards, tasks)
   - income/expenses: Mpitahiry vola, Sekretera (Sekretera's entries wait for the Mpitahiry vola)
   - fees: Mpitahiry vola, Sekretera
   - donation and income/expense confirmation: Mpitahiry vola only
   - loans/returns: Vaomiera Fitaovana, Birao, Mpandrindra
   - arrivals at meetings: Birao, Mpandrindra, Zo = "Mpandray fahatongavana"
   - cards and photos: Birao, Mpandrindra */
function rights_(m) {
  const office = isOffice_(m), treasurer = isTreasurer_(m), secretary = isSecretary_(m);
  return {
    tx: treasurer || secretary,
    tx_direct: treasurer,
    fees: treasurer || secretary,
    confirm: treasurer,
    materials: office || m["Vaomiera"] === "Fitaovana",
    attendance: office || m["Zo"] === "Mpandray fahatongavana",
    cards: office,
    tasks_admin: office,
    members_add: office,                                              // register new members (phone app)
    broadcast: m["Vaomiera"] === "Fifandraisana" || m["Zo"] === "Mpandrindra"   // SMS announcement to everyone
  };
}
function canAny_(m) { const r = rights_(m); return r.tx || r.fees || r.confirm || r.materials || r.attendance || r.cards || r.members_add; }

/* ==========================================================================
   Members: dashboard data
   ========================================================================== */
function me_(m) {
  const set = settings_();
  const fy = feeYear_();
  const members = rows_("members");
  const feeRows = confirmedFees_();
  const nameOf = id => { const x = members.find(r => String(r["ID"]) === String(id)); return x ? x["Anarana feno"] : id; };

  /* --- my fees for the current fee year (October → August) --- */
  const months = feeMonths_(m, feeRows, fy, set);

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
      mine: canEditTask_(m, who, false), can_edit: canEditTask_(m, who, true),
      goal_id: String(t["ID tanjona"] || ""), visible: t["Aseho"] !== "Tsia",
      commission: taskCommission_(t, members)
    };
  }).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  /* --- all goals with their steps (also those not shown publicly) --- */
  const goalsOut = goals.filter(g => g["ID"] && g["Lohateny"]).map(g => ({
    id: String(g["ID"]), title: g["Lohateny"], description: g["Famaritana"] || "",
    target_date: iso_(g["Fe-potoana"]), visible: g["Aseho"] !== "Tsia",
    steps: tasks.filter(x => x.goal_id === String(g["ID"]))
  }));

  /* --- rankings (current year) --- */
  const active = members.filter(r => r["ID"] && r["Sata"] !== "Tsy mavitrika");
  const feeTop = active.map(r => ({ name: r["Anarana feno"],
      count: feeMonths_(r, feeRows, fy, set).filter(x => x.on_time).length }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  const att = attendanceData_(fy, set);
  const attTop = active.map(r => ({ name: r["Anarana feno"],
      count: att.list.filter(a => a.id === String(r["ID"])).length }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);

  const out = {
    ok: true,
    member: { id: m["ID"], name: m["Anarana feno"], commission: m["Vaomiera"], office_role: m["Andraikitra Birao"] || "",
              is_office: isOffice_(m), can: rights_(m), photo: String(m["Sary"] || "") },
    fees: { year: fy.label, monthly_amount: feeFor_(m, set), category: m["Sokajy"] || "", months },
    attendance: attendanceStats_(m["ID"], att),
    meeting: { start: set.meetingStart, tolerance: set.tolerance || 0 },
    loans, tasks, goals: goalsOut,
    commissions: V.commissions,
    can_add_tasks: isOffice_(m) ? V.commissions : (m["Vaomiera"] ? [m["Vaomiera"]] : []),
    people: members.filter(r => r["ID"] && r["Sata"] !== "Tsy mavitrika")
                   .map(r => ({ id: String(r["ID"]), name: r["Anarana feno"], commission: r["Vaomiera"] || "" })),
    top: { fees: feeTop, attendance: attTop },
    finance: financeSummary_(5)
  };

  /* --- office only: everyone's fees --- */
  if (isOffice_(m)) {
    out.fees_all = active.map(r => ({ id: r["ID"], name: r["Anarana feno"],
      months: feeMonths_(r, feeRows, fy, set).map(x => x.paid ? (x.on_time ? "on_time" : "late")
                                                      : x.not_member ? "na" : x.future ? "future" : "unpaid") }));
    out.attendance_all = active.map(r => Object.assign({ id: r["ID"], name: r["Anarana feno"] }, attendanceStats_(r["ID"], att)))
      .sort((a, b) => b.present - a.present || a.late - b.late);
  }
  return out;
}

function feeMonths_(m, feeRows, fy, set) {
  const now = new Date();
  const joined = m["Daty niditra"] instanceof Date ? m["Daty niditra"] : null;
  const mine = feeRows.filter(f => String(f["ID mpikambana"]) === String(m["ID"]));
  return fy.keys.map(key => {
    const y = Number(key.slice(0, 4)), mo = Number(key.slice(5, 7));
    const f = mine.find(x => monthKey_(x["Volana"]) === key);
    const beforeJoin = joined && (joined.getFullYear() > y || (joined.getFullYear() === y && joined.getMonth() + 1 > mo));
    const deadline = new Date(y, mo, set.deadlineDay, 23, 59, 59);   // day X of the following month
    const future = now <= deadline;                                    // not yet due
    let onTime = false;
    if (f && f["Daty naloa"] instanceof Date) onTime = f["Daty naloa"] <= deadline;
    else if (f) onTime = true;
    return { month: key, paid: !!f, on_time: !!f && onTime, date: f ? iso_(f["Daty naloa"]) : "",
             amount: f ? num_(f["Vola"]) : 0, future, not_member: !!beforeJoin };
  });
}

/* Arrivals at meetings during the fee year: one row per member and day (earliest time kept) */
function attendanceData_(fy, set) {
  const byKey = {};
  rows_("attendance").forEach(a => {
    if (!(a["Daty"] instanceof Date) || a["Daty"] < fy.from || a["Daty"] > fy.to || !a["ID mpikambana"]) return;
    const day = iso_(a["Daty"]), id = String(a["ID mpikambana"]), time = timeText_(a["Ora tonga"]);
    const k = id + "|" + day;
    if (!byKey[k] || (time && (!byKey[k].time || time < byKey[k].time))) byKey[k] = { id, day, time };
  });
  const list = Object.keys(byKey).map(k => byKey[k]);
  const limit = minutes_(set.meetingStart) + (set.tolerance || 0);
  list.forEach(x => { x.late = x.time ? minutes_(x.time) > limit : null; });
  const days = Array.from(new Set(list.map(x => x.day))).sort();
  return { list, meetings: days.length };
}

function attendanceStats_(id, att) {
  const mine = att.list.filter(x => x.id === String(id)).sort((a, b) => (a.day < b.day ? 1 : -1));
  const timed = mine.filter(x => x.time);
  const avg = timed.length ? Math.round(timed.reduce((s, x) => s + minutes_(x.time), 0) / timed.length) : null;
  return {
    meetings: att.meetings, present: mine.length,
    on_time: timed.filter(x => !x.late).length, late: timed.filter(x => x.late).length,
    avg_time: avg === null ? "" : ("0" + Math.floor(avg / 60)).slice(-2) + ":" + ("0" + (avg % 60)).slice(-2),
    last: mine.slice(0, 6).map(x => ({ date: x.day, time: x.time, late: x.late }))
  };
}

function financeSummary_(limit) {
  const set = settings_();
  // entries of the Sekretera count only after the Mpitahiry vola confirmed them
  const tx = rows_("transactions").filter(t => t["Vola"] !== "" && t["Karazany"] && t["Sata"] !== "Miandry" && t["Sata"] !== "Nolavina");
  const don = rows_("donations").filter(d => d["Sata"] === "Voamarina");
  const fees = confirmedFees_().filter(f => f["Vola"] !== "");
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

/* Commission of a task: the "Vaomiera" column, else the commission in charge, else the member's commission */
function taskCommission_(t, members) {
  if (t["Vaomiera"]) return String(t["Vaomiera"]);
  const who = String(t["Tompon'andraikitra"] || "").trim();
  const c = V.commissions.find(x => x.toLowerCase() === who.toLowerCase());
  if (c) return c;
  const mem = members.find(x => String(x["ID"]).toUpperCase() === who.toUpperCase());
  return mem ? String(mem["Vaomiera"] || "") : "";
}

/* Next free ID like A12 / T4 in a sheet */
function nextId_(key, prefix) {
  let max = 0;
  rows_(key).forEach(r => { const mm = String(r["ID"]).match(new RegExp("^" + prefix + "(\\d+)$")); if (mm) max = Math.max(max, Number(mm[1])); });
  return prefix + (max + 1);
}

/* A commission adds a task (step) to a goal; Birao/Mpandrindra may add for any commission */
function addTask_(m, b) {
  const commission = V.commissions.find(c => c === b.commission);
  if (!commission) return { ok: false, error: "missing_fields" };
  if (!isOffice_(m) && m["Vaomiera"] !== commission) return { ok: false, error: "forbidden" };
  const title = String(b.title || "").trim();
  if (!title) return { ok: false, error: "missing_fields" };
  if (!rows_("goals").some(g => String(g["ID"]) === String(b.goal_id))) return { ok: false, error: "not_found" };
  let assignee = commission;
  if (b.assignee && b.assignee !== commission) {
    const mem = rows_("members").find(x => String(x["ID"]) === String(b.assignee));
    if (!mem) return { ok: false, error: "unknown_member" };
    assignee = String(mem["ID"]);
  }
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const id = nextId_("tasks", "A");
    sheet_("tasks").appendRow([id, String(b.goal_id), safe_(title, 200), assignee, b.due ? dateFrom_(b.due) : "",
      "Hatao", "", "Nampiditra: " + m["Anarana feno"], b.visible === false ? "Tsia" : "Eny", commission]);
    return { ok: true, id };
  } finally { lock.releaseLock(); }
}

/* Birao/Mpandrindra add a goal */
function addGoal_(m, b) {
  if (!isOffice_(m)) return { ok: false, error: "forbidden" };
  const title = String(b.title || "").trim();
  if (!title) return { ok: false, error: "missing_fields" };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const id = nextId_("goals", "T");
    sheet_("goals").appendRow([id, safe_(title, 200), safe_(b.description, 500), b.due ? dateFrom_(b.due) : "", b.visible === false ? "Tsia" : "Eny"]);
    return { ok: true, id };
  } finally { lock.releaseLock(); }
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
  const monthly = num_(map["Latsakemboka isam-bolana"]) || 0;
  return {
    monthly: monthly,
    feeStudent: num_(map["Latsakemboka mpianatra"]) || monthly,
    feeWorker: num_(map["Latsakemboka miasa"]) || monthly,
    deadlineDay: num_(map["Daty farany handoavana"]) || 10,
    opening: num_(map["Vola tany am-boalohany"]) || 0,
    reminderDays: num_(map["Fampahatsiahivana (andro mialoha)"]) || 3,
    meetingStart: timeText_(map["Ora fiandohan'ny fivoriana"]) || "14:00",
    inviteContact: String(map["Fifandraisana mandray fanasana (ID)"] || "").trim(),
    assocEmail: String(map["Mailaka fikambanana"] || "").trim(),
    tolerance: num_(map["Fahatarana azo leferina (minitra)"])
  };
}

/* Fees counted as paid: not waiting for confirmation, not rejected (old rows without Sata count) */
function confirmedFees_() { return rows_("fees").filter(f => f["Sata"] !== "Miandry" && f["Sata"] !== "Nolavina"); }

/* Monthly fee of a member according to the "Sokajy" column */
function feeFor_(m, set) {
  if (m["Sokajy"] === "Mpianatra") return set.feeStudent;
  if (m["Sokajy"] === "Miasa") return set.feeWorker;
  return set.monthly;
}

/* Current fee year: October → August. September already belongs to the next year. */
function feeYear_(now) {
  now = now || new Date();
  const start = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const keys = FEE_MONTHS.map(mo => (mo >= 10 ? start : start + 1) + "-" + ("0" + mo).slice(-2));
  return { label: start + "–" + (start + 1), keys: keys,
           from: new Date(start, 9, 1), to: new Date(start + 1, 7, 31, 23, 59, 59) };
}

/* "14:05", a Date (time cell) or 14.08… → "14:05" */
function timeText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "HH:mm");
  const m = String(v || "").match(/(\d{1,2})[:h](\d{2})/);
  return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "";
}
function minutes_(hhmm) { const p = String(hhmm).split(":"); return Number(p[0]) * 60 + Number(p[1]); }

function iso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return v ? String(v).slice(0, 10) : "";
}
function monthKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM");
  return String(v || "").trim().replace(/^'/, "").slice(0, 7);
}
function num_(v) { return Number(String(v).replace(/[^\d.-]/g, "")) || 0; }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
   Phone entry app (fampidirana.html) – staff only
   ========================================================================== */
function staffLists_(m) {
  if (!canAny_(m)) return { ok: false, error: "forbidden" };
  const r = rights_(m);
  const now = new Date();
  const set = settings_();
  const members = rows_("members").filter(x => x["ID"] && x["Sata"] !== "Tsy mavitrika");
  const nameOf = id => { const x = members.find(y => String(y["ID"]) === String(id)); return x ? x["Anarana feno"] : ""; };

  const paid = {};
  rows_("fees").filter(f => f["Sata"] !== "Nolavina").forEach(f => {   // pending fees count here to avoid entering them twice
    const id = String(f["ID mpikambana"]); const k = monthKey_(f["Volana"]);
    if (!id || !k) return;
    (paid[id] = paid[id] || []).push(k);
  });

  const loans = rows_("loans");
  const materials = rows_("materials").filter(x => x["ID"]).map(x => {
    const open = loans.filter(l => String(l["ID fitaovana"]) === String(x["ID"]) && !l["Daty naverina"]).pop();
    return { id: String(x["ID"]), type: x["Karazany"] || "", desc: x["Famaritana"] || "", size: x["Habe"] || "",
             holder_id: open ? String(open["ID mpikambana"]) : "", holder_name: open ? nameOf(open["ID mpikambana"]) : "",
             since: open ? iso_(open["Daty nindramana"]) : "" };
  });

  const out = {
    ok: true,
    me: { id: m["ID"], name: m["Anarana feno"], can: r },
    year: feeYear_(now).label,
    fee_months: feeYear_(now).keys,
    members: members.map(x => ({ id: String(x["ID"]), name: x["Anarana feno"], commission: x["Vaomiera"] || "",
                                 role: x["Andraikitra Birao"] || "", photo: String(x["Sary"] || ""),
                                 category: x["Sokajy"] || "", fee: feeFor_(x, set),
                                 paid: paid[String(x["ID"])] || [] })),
    materials
  };
  if (r.confirm) {
    out.pending_tx = rows_("transactions").filter(t => t["Sata"] === "Miandry" && t["ID"]).map(t => ({
      id: String(t["ID"]), date: iso_(t["Daty"]), kind: t["Karazany"] === "Miditra" ? "in" : "out",
      amount: num_(t["Vola"]), reason: t["Antony"] || "", category: t["Sokajy"] || "", by: t["Nampiditra"] || "" }));
    const people = rows_("members");
    const groups = {};
    rows_("fees").filter(f => f["Sata"] === "Miandry" && f["ID"]).forEach(f => {
      const id = String(f["ID"]);
      const g = groups[id] = groups[id] || { id, date: iso_(f["Daty naloa"]), member_id: String(f["ID mpikambana"]), months: [], amount: 0, by: f["Nampiditra"] || "" };
      g.months.push(monthKey_(f["Volana"])); g.amount += num_(f["Vola"]);
    });
    out.pending_fees = Object.keys(groups).map(k => {
      const g = groups[k]; const p = people.find(x => String(x["ID"]) === g.member_id);
      return Object.assign(g, { member_name: p ? p["Anarana feno"] : g.member_id });
    });
    out.pending_donations = rows_("donations").filter(d => d["Sata"] === "Miandry").map(d => ({
      key: donationKey_(d), date: iso_(d["Daty nandefasana"]), name: d["Anarana"], phone: String(d["Finday"] || ""),
      amount: num_(d["Vola"]), operator: d["Tambajotra"] || "", reference: String(d["Référence"] || ""),
      show_name: d["Aseho anarana"] === "Eny", message: d["Hafatra"] || "" }));
  }
  return out;
}

function donationKey_(d) {
  const t = d["Voaray tamin'ny"] instanceof Date ? Utilities.formatDate(d["Voaray tamin'ny"], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(d["Voaray tamin'ny"]);
  return String(d["Référence"] || "") + "|" + t;
}

/* Receives the queue of operations saved on the phone (possibly offline) */
function sync_(m, b) {
  if (!canAny_(m)) return { ok: false, error: "forbidden" };
  const ops = Array.isArray(b.ops) ? b.ops.slice(0, 200) : [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const logSh = sheet_("log");
    const done = {};
    rows_("log").forEach(l => { if (l["op_id"]) done[String(l["op_id"])] = true; });
    const results = ops.map(op => {
      if (!op || !op.op_id) return { op_id: "", ok: false, error: "bad_op" };
      if (done[op.op_id]) return { op_id: op.op_id, ok: true, dup: true };
      let res;
      try { res = applyOp_(m, op.type, op.data || {}); }
      catch (err) { res = { ok: false, error: String(err) }; }
      if (res.ok) {
        const logged = Object.assign({}, op.data || {}); if (logged.image) logged.image = "(sary)";
        logSh.appendRow([new Date(), m["Anarana feno"], op.type, JSON.stringify(logged).slice(0, 500), op.op_id]);
        done[op.op_id] = true;
      }
      return Object.assign({ op_id: op.op_id }, res);
    });
    return { ok: true, results };
  } finally { lock.releaseLock(); }
}

function applyOp_(m, type, d) {
  const r = rights_(m);
  const who = m["Anarana feno"];
  const date = dateFrom_(d.date);
  const memberExists = id => rows_("members").some(x => String(x["ID"]) === String(id));

  switch (type) {
    case "tx": {
      if (!r.tx) return { ok: false, error: "forbidden" };
      const amount = num_(d.amount);
      if (!(amount > 0) || !d.reason || (d.kind !== "in" && d.kind !== "out")) return { ok: false, error: "missing_fields" };
      const status = r.tx_direct ? "Voamarina" : "Miandry";
      sheet_("transactions").appendRow([date, d.kind === "in" ? "Miditra" : "Mivoaka", amount, safe_(d.reason, 200),
        safe_(d.category, 60), who, status, "TX-" + Utilities.getUuid().slice(0, 8)]);
      return { ok: true, pending: status === "Miandry" };
    }
    case "fee_status": {
      if (!r.confirm) return { ok: false, error: "forbidden" };
      if (d.status !== "Voamarina" && d.status !== "Nolavina") return { ok: false, error: "missing_fields" };
      const sh = sheet_("fees");
      const data = sh.getDataRange().getValues();
      const h = data[0];
      const cId = h.indexOf("ID"), cSt = h.indexOf("Sata");
      let n = 0;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][cId]) === String(d.id)) { sh.getRange(i + 1, cSt + 1).setValue(d.status); n++; }
      }
      return n ? { ok: true } : { ok: false, error: "not_found" };
    }
    case "tx_status": {
      if (!r.confirm) return { ok: false, error: "forbidden" };
      if (d.status !== "Voamarina" && d.status !== "Nolavina") return { ok: false, error: "missing_fields" };
      const sh = sheet_("transactions");
      const data = sh.getDataRange().getValues();
      const h = data[0];
      const cId = h.indexOf("ID"), cSt = h.indexOf("Sata");
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][cId]) === String(d.id)) {
          sh.getRange(i + 1, cSt + 1).setValue(d.status);
          return { ok: true };
        }
      }
      return { ok: false, error: "not_found" };
    }
    case "fee": {
      if (!r.fees) return { ok: false, error: "forbidden" };
      const member = rows_("members").find(x => String(x["ID"]) === String(d.member_id));
      if (!member) return { ok: false, error: "unknown_member" };
      const amount = feeFor_(member, settings_());                 // fixed by the member's Sokajy
      const months = (d.months || []).filter(k => /^\d{4}-(0[1-8]|1[0-2])$/.test(k));   // never September
      if (!(amount > 0) || !months.length) return { ok: false, error: "missing_fields" };
      const existing = rows_("fees").filter(f => String(f["ID mpikambana"]) === String(d.member_id) && f["Sata"] !== "Nolavina").map(f => monthKey_(f["Volana"]));
      const status = r.tx_direct ? "Voamarina" : "Miandry";       // the Sekretera's entries wait for the Mpitahiry vola
      const batch = "FE-" + Utilities.getUuid().slice(0, 8);
      const sh = sheet_("fees");
      const added = [], skipped = [];
      months.forEach(k => {
        if (existing.indexOf(k) >= 0) { skipped.push(k); return; }
        sh.appendRow([date, String(d.member_id), "'" + k, amount, who, "", status, batch]);
        added.push(k);
      });
      return { ok: true, added, skipped, amount, pending: status === "Miandry" };
    }
    case "loan": {
      if (!r.materials) return { ok: false, error: "forbidden" };
      if (!rows_("materials").some(x => String(x["ID"]) === String(d.material_id))) return { ok: false, error: "unknown_material" };
      if (!memberExists(d.member_id)) return { ok: false, error: "unknown_member" };
      const open = rows_("loans").some(l => String(l["ID fitaovana"]) === String(d.material_id) && !l["Daty naverina"]);
      if (open) return { ok: false, error: "already_out" };
      sheet_("loans").appendRow([date, String(d.material_id), String(d.member_id), "", safe_(d.note, 200)]);
      return { ok: true };
    }
    case "return": {
      if (!r.materials) return { ok: false, error: "forbidden" };
      const sh = sheet_("loans");
      const data = sh.getDataRange().getValues();
      const h = data[0];
      const cMat = h.indexOf("ID fitaovana"), cRet = h.indexOf("Daty naverina");
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][cMat]) === String(d.material_id) && !data[i][cRet]) {
          sh.getRange(i + 1, cRet + 1).setValue(date);
          return { ok: true };
        }
      }
      return { ok: false, error: "not_out" };
    }
    case "attendance": {
      if (!r.attendance) return { ok: false, error: "forbidden" };
      if (!memberExists(d.member_id)) return { ok: false, error: "unknown_member" };
      const day = iso_(date);
      const time = timeText_(d.time) || Utilities.formatDate(new Date(), TZ, "HH:mm");
      const dup = rows_("attendance").some(a => iso_(a["Daty"]) === day && String(a["ID mpikambana"]) === String(d.member_id));
      if (dup) return { ok: true, dup: true };                      // first arrival of the day is kept
      sheet_("attendance").appendRow([date, String(d.member_id), "'" + time]);
      return { ok: true };
    }
    case "donation_status": {
      if (!r.confirm) return { ok: false, error: "forbidden" };
      if (d.status !== "Voamarina" && d.status !== "Nolavina") return { ok: false, error: "missing_fields" };
      const sh = sheet_("donations");
      const data = sh.getDataRange().getValues();
      const h = data[0];
      const cSt = h.indexOf("Sata"), cDate = h.indexOf("Daty voamarina");
      for (let i = 1; i < data.length; i++) {
        const row = {}; h.forEach((k, j) => { row[k] = data[i][j]; });
        if (donationKey_(row) === d.key) {
          sh.getRange(i + 1, cSt + 1).setValue(d.status);
          sh.getRange(i + 1, cDate + 1).setValue(new Date());
          return { ok: true };
        }
      }
      return { ok: false, error: "not_found" };
    }
    case "photo": {
      if (!r.cards) return { ok: false, error: "forbidden" };
      if (!memberExists(d.member_id)) return { ok: false, error: "unknown_member" };
      const id = savePhoto_(d.member_id, d.image);
      return id ? { ok: true, photo: id } : { ok: false, error: "bad_image" };
    }
    default:
      return { ok: false, error: "unknown_op" };
  }
}

function dateFrom_(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}
/* Text from the phone: limit length and stop it being read as a formula */
function safe_(s, n) { const t = String(s || "").slice(0, n); return /^[=+\-@]/.test(t) ? "'" + t : t; }

/* ==========================================================================
   SMS reminders – "SMS Gateway for Android" (https://sms-gate.app), cloud mode
   1. Install the app on the spare Android phone, switch on "Cloud server",
      note the username and password it shows.
   2. Menu ZA SPaFi > SMS: ampidiro ny kaonty SMS Gateway
   3. Menu ZA SPaFi > SMS: andramo   (test)
   4. Menu ZA SPaFi > SMS: alefaso isan'andro ny fampahatsiahivana (daily, ~8:00)
   ========================================================================== */
const SMS_URL = "https://api.sms-gate.app/3rdparty/v1/messages";
const SMS_MAX_PER_RUN = 60;

function smsSetCredentials() {
  const ui = SpreadsheetApp.getUi();
  const u = ui.prompt("SMS Gateway", "Username (hita ao amin'ny application, Cloud server):", ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const p = ui.prompt("SMS Gateway", "Password:", ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperties({ SMS_USER: u.getResponseText().trim(), SMS_PASS: p.getResponseText().trim() });
  ui.alert("Voatahiry ny kaonty SMS.");
}

function smsTest() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("SMS fanandramana", "Laharana handefasana (oh: 034 12 345 67):", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const res = smsSend_([r.getResponseText()], "ZA SPaFi Toliara: SMS fanandramana. Mandeha tsara ny fampahatsiahivana.");
  ui.alert(res.ok ? "Lasa ny SMS." : "Tsy lasa: " + res.error);
}

function smsSend_(phones, text) {
  const props = PropertiesService.getScriptProperties();
  const user = props.getProperty("SMS_USER"), pass = props.getProperty("SMS_PASS");
  if (!user || !pass) return { ok: false, error: "Tsy mbola misy kaonty SMS (menu ZA SPaFi > SMS)" };
  const numbers = phones.map(phoneIntl_).filter(Boolean);
  if (!numbers.length) return { ok: false, error: "Tsy misy laharana mety" };
  const unique = Array.from(new Set(numbers));
  // send in groups of 20 numbers per request
  for (let i = 0; i < unique.length; i += 20) {
    const res = UrlFetchApp.fetch(SMS_URL, {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { Authorization: "Basic " + Utilities.base64Encode(user + ":" + pass) },
      payload: JSON.stringify({ textMessage: { text: text }, phoneNumbers: unique.slice(i, i + 20) })
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) return { ok: false, error: "HTTP " + code + " " + res.getContentText().slice(0, 200), sent: i };
  }
  return { ok: true, sent: unique.length };
}

/* "034 12 345 67" / "0341234567" / "+261 34..." -> "+261341234567" */
function phoneIntl_(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (/^261\d{9}$/.test(d)) return "+" + d;
  if (/^0\d{9}$/.test(d)) return "+261" + d.slice(1);
  if (/^\d{9}$/.test(d)) return "+261" + d;
  return "";
}

function installReminderTrigger() {
  removeReminderTrigger(true);
  ScriptApp.newTrigger("sendReminders").timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert("Hisy fampahatsiahivana SMS alefa isan'andro amin'ny 8 ora maraina eo ho eo.");
}
function removeReminderTrigger(silent) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "sendReminders").forEach(t => ScriptApp.deleteTrigger(t));
  if (silent !== true) SpreadsheetApp.getUi().alert("Najanona ny fampahatsiahivana SMS.");
}

/* Runs every day: N days before the deadline, on the day, and the day after (if not done) */
function sendReminders() {
  const set = settings_();
  const members = rows_("members").filter(x => x["ID"] && x["Sata"] !== "Tsy mavitrika");
  const sent = {};
  rows_("log").forEach(l => { if (String(l["op_id"]).indexOf("rem|") === 0) sent[l["op_id"]] = true; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = d => Utilities.formatDate(d, TZ, "dd/MM");
  const logSh = sheet_("log");
  let count = 0;

  rows_("tasks").forEach(t => {
    if (count >= SMS_MAX_PER_RUN) return;
    if (!t["Asa"] || t["Sata"] === "Vita" || !(t["Fe-potoana"] instanceof Date)) return;
    const due = new Date(t["Fe-potoana"]); due.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    let kind = "";
    if (days === set.reminderDays) kind = "before";
    else if (days === 0) kind = "today";
    else if (days === -1) kind = "late";
    if (!kind) return;
    const key = "rem|" + t["ID"] + "|" + kind + "|" + iso_(due);
    if (sent[key]) return;

    const who = String(t["Tompon'andraikitra"] || "").trim();
    const targets = /^ZA-\d+$/i.test(who)
      ? members.filter(x => String(x["ID"]).toUpperCase() === who.toUpperCase())
      : members.filter(x => String(x["Vaomiera"]).toLowerCase() === who.toLowerCase());
    const phones = targets.map(x => x["Finday"]).filter(Boolean);
    if (!phones.length) return;

    const title = String(t["Asa"]).slice(0, 60);
    const text = kind === "before"
      ? "ZA SPaFi: Fampahatsiahivana. Asa: " + title + ". Fe-potoana: " + fmt(due) + " (" + days + " andro sisa). Rehefa vita, mariho ao amin'ny tranonkala. Misaotra!"
      : kind === "today"
        ? "ZA SPaFi: Androany no fe-potoan'ny asa: " + title + ". Rehefa vita, mariho ao amin'ny tranonkala. Misaotra!"
        : "ZA SPaFi: Tara ny asa: " + title + " (fe-potoana " + fmt(due) + "). Mariho ao amin'ny tranonkala raha efa vita. Misaotra!";
    const res = smsSend_(phones, text);
    if (res.ok) {
      logSh.appendRow([new Date(), "SMS", "reminder", title + " → " + targets.map(x => x["ID"]).join(", "), key]);
      count += phones.length;
    } else {
      console.error("SMS failed for task " + t["ID"] + ": " + res.error);
    }
  });
}

/* ==========================================================================
   Member photos (head shots for the cards)
   Saved as small JPEG files in a Google Drive folder of the choir account,
   readable by anyone who has the link (needed to show them on the website).
   The file ID is written in the "Sary" column of Mpikambana.
   ========================================================================== */
const PHOTO_FOLDER_NAME = "ZA SPaFi Toliara – Sary mpikambana";

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("PHOTO_FOLDER");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: create again */ } }
  const f = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty("PHOTO_FOLDER", f.getId());
  return f;
}

function savePhoto_(memberId, dataUrl) {
  const m = String(dataUrl || "").match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!m) return "";
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 400000) return "";                     // the app sends ~40 KB; refuse huge files
  const blob = Utilities.newBlob(bytes, "image/" + m[1], memberId + ".jpg");
  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const sh = sheet_("members");
  const data = sh.getDataRange().getValues();
  const h = data[0];
  const cId = h.indexOf("ID"), cPhoto = h.indexOf("Sary");
  if (cPhoto < 0) throw new Error("Missing column Sary (run setup)");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cId]) === String(memberId)) {
      const old = String(data[i][cPhoto] || "");
      if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { /* already gone */ } }
      sh.getRange(i + 1, cPhoto + 1).setValue(file.getId());
      return file.getId();
    }
  }
  file.setTrashed(true);
  return "";
}

/* ==========================================================================
   SMS sent by hand from the website
   ========================================================================== */
const DAYS_MG = ["Alahady", "Alatsinainy", "Talata", "Alarobia", "Alakamisy", "Zoma", "Sabotsy"];
function dayText_(iso) {
  const d = dateFrom_(iso);
  return DAYS_MG[d.getDay()] + " " + Utilities.formatDate(d, TZ, "dd/MM/yyyy");
}
function logSms_(m, what, detail, n) {
  sheet_("log").appendRow([new Date(), m ? m["Anarana feno"] : "SMS", what, String(detail).slice(0, 450) + " (" + n + " SMS)", "sms|" + Utilities.getUuid()]);
}
function activePhones_(filter) {
  return rows_("members").filter(x => x["ID"] && x["Sata"] !== "Tsy mavitrika" && x["Finday"] && (!filter || filter(x)));
}

/* 1. Meeting / event announcement to every active member (Birao, Mpandrindra) */
function broadcastText_(b) {
  const place = String(b.place || "").trim(), time = timeText_(b.time), date = String(b.date || "");
  if (!place || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let title = "Fivoriana";
  if (b.kind === "hamonjy") title = "Hamonjy antsam-panahy";
  else if (b.kind === "hafa") title = String(b.other || "").trim().slice(0, 80);
  if (!title) return null;
  let text = "ZA SPaFi: " + title + ". Andro: " + dayText_(date) + ". Ora: " + time + ". Toerana: " + place.slice(0, 80) + ".";
  if (b.kind === "hamonjy") {
    if (String(b.male || "").trim()) text += " Fanamiana lahy: " + String(b.male).trim().slice(0, 80) + ".";
    if (String(b.female || "").trim()) text += " Fanamiana vavy: " + String(b.female).trim().slice(0, 80) + ".";
  }
  return text + " Tongava ara-potoana. Misaotra!";
}
function broadcast_(m, b) {
  if (!rights_(m).broadcast) return { ok: false, error: "forbidden" };
  const text = broadcastText_(b);
  if (!text) return { ok: false, error: "missing_fields" };
  const people = activePhones_();
  if (b.preview) return { ok: true, text, count: people.length };
  const res = smsSend_(people.map(x => x["Finday"]), text);
  if (res.ok) logSms_(m, "broadcast", text, res.sent);
  return res.ok ? { ok: true, sent: res.sent, text } : { ok: false, error: "sms_failed", detail: res.error };
}

/* 2. Task reminder sent now (Birao, Mpandrindra) */
function notifyTask_(m, b) {
  if (!isOffice_(m)) return { ok: false, error: "forbidden" };
  const t = rows_("tasks").find(x => String(x["ID"]) === String(b.task_id));
  if (!t) return { ok: false, error: "not_found" };
  const who = String(t["Tompon'andraikitra"] || "").trim();
  const targets = /^ZA-\d+$/i.test(who)
    ? activePhones_(x => String(x["ID"]).toUpperCase() === who.toUpperCase())
    : activePhones_(x => String(x["Vaomiera"]).toLowerCase() === (who || String(t["Vaomiera"] || "")).toLowerCase());
  if (!targets.length) return { ok: false, error: "no_phone" };
  const due = t["Fe-potoana"] instanceof Date ? " Fe-potoana: " + Utilities.formatDate(t["Fe-potoana"], TZ, "dd/MM/yyyy") + "." : "";
  const text = "ZA SPaFi: Fampahatsiahivana. Asa: " + String(t["Asa"]).slice(0, 80) + "." + due + " Rehefa vita, mariho ao amin'ny tranonkala. Misaotra!";
  const res = smsSend_(targets.map(x => x["Finday"]), text);
  if (res.ok) logSms_(m, "task", text, res.sent);
  return res.ok ? { ok: true, sent: res.sent } : { ok: false, error: "sms_failed", detail: res.error };
}

/* 3. Materials not returned (Birao, Mpandrindra, Vaomiera Fitaovana): one SMS per member, naming the items */
function notifyMaterials_(m, b) {
  if (!rights_(m).materials) return { ok: false, error: "forbidden" };
  const ids = (b.material_ids || []).map(String);
  const mats = rows_("materials");
  const open = rows_("loans").filter(l => !l["Daty naverina"] && (!ids.length || ids.indexOf(String(l["ID fitaovana"])) >= 0));
  const byMember = {};
  open.forEach(l => { (byMember[String(l["ID mpikambana"])] = byMember[String(l["ID mpikambana"])] || []).push(l); });
  const members = activePhones_();
  let sent = 0, missing = 0;
  Object.keys(byMember).forEach(id => {
    const p = members.find(x => String(x["ID"]) === id);
    if (!p) { missing++; return; }
    const names = byMember[id].map(l => {
      const x = mats.find(y => String(y["ID"]) === String(l["ID fitaovana"])) || {};
      const type = String(x["Karazany"] || ""), desc = String(x["Famaritana"] || "");
      const label = desc.toLowerCase().indexOf(type.toLowerCase()) === 0 ? desc : [type, desc].filter(Boolean).join(" ");
      return [label, x["Habe"]].filter(Boolean).join(" ") || String(l["ID fitaovana"]);
    });
    const text = "ZA SPaFi: Fampahatsiahivana. Mbola eo aminao: " + names.join(", ").slice(0, 200) + ". Mba averina amin'ny Vaomiera Fitaovana azafady. Misaotra!";
    const res = smsSend_([p["Finday"]], text);
    if (res.ok) { sent++; logSms_(m, "materials", text, 1); } else missing++;
  });
  return { ok: true, sent, missing };
}

/* ==========================================================================
   Invitation form (fanasana.html) – public
   The letter is saved in a PRIVATE Drive folder of the choir account.
   ========================================================================== */
const INVITE_FOLDER_NAME = "ZA SPaFi Toliara – Fanasana";

function inviteFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("INVITE_FOLDER");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: create again */ } }
  const f = DriveApp.createFolder(INVITE_FOLDER_NAME);
  props.setProperty("INVITE_FOLDER", f.getId());
  return f;
}

function addInvitation_(b) {
  if (b.website) return { ok: true };                                   // spam trap
  const name = String(b.name || "").trim(), group = String(b.group || "").trim();
  const phone = String(b.phone || "").trim(), email = String(b.email || "").trim(), subject = String(b.subject || "").trim();
  if (!name || !group || !phone || !subject) return { ok: false, error: "missing_fields" };
  if (!phoneIntl_(phone)) return { ok: false, error: "bad_phone" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "bad_email" };
  const fm = String(b.file || "").match(/^data:(application\/pdf|image\/jpeg|image\/png);base64,(.+)$/);
  if (!fm) return { ok: false, error: "missing_file" };

  // at most one invitation per phone number every 2 minutes
  const cache = CacheService.getScriptCache(), ck = "inv_" + phoneIntl_(phone);
  if (cache.get(ck)) return { ok: false, error: "too_fast" };
  cache.put(ck, "1", 120);

  const bytes = Utilities.base64Decode(fm[2]);
  if (bytes.length > 8 * 1024 * 1024) return { ok: false, error: "file_too_big" };
  const ext = fm[1] === "application/pdf" ? "pdf" : fm[1] === "image/png" ? "png" : "jpg";
  const stamp = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd_HHmm");
  const file = inviteFolder_().createFile(Utilities.newBlob(bytes, fm[1], stamp + "_" + group.replace(/[^\w\- ]+/g, "").slice(0, 40) + "." + ext));

  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    sheet_("invitations").appendRow([new Date(), safe_(name, 120), safe_(group, 160), "'" + phone.slice(0, 30), safe_(email, 120),
      safe_(subject, 500), file.getUrl(), "Vaovao", ""]);
  } finally { lock.releaseLock(); }

  // notify the Birao and the Fifandraisana contact by SMS, and the association by email
  const set = settings_();
  const short = group.slice(0, 40) + " (" + name.slice(0, 30) + ", " + phone + "): " + subject.slice(0, 60);
  try {
    const targets = activePhones_(x => x["Birao"] === "Eny" || (set.inviteContact && String(x["ID"]).toUpperCase() === set.inviteContact.toUpperCase()));
    if (targets.length) smsSend_(targets.map(x => x["Finday"]), "ZA SPaFi: Fanasana vaovao avy amin'i " + short + ". Jereo ny takelaka Fanasana.");
  } catch (e) { console.error("invite sms", e); }
  try {
    const to = set.assocEmail || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, "Fanasana vaovao: " + group,
      "Nisy fanasana vaovao voaray tamin'ny tranonkala.\n\nAnarana: " + name + "\nFikambanana / vondrona: " + group +
      "\nFinday: " + phone + (email ? "\nMailaka: " + email : "") + "\n\nLohahevitra:\n" + subject + "\n\nTaratasy: " + file.getUrl(),
      { name: "ZA SPaFi Toliara – tranonkala" });
  } catch (e) { console.error("invite mail", e); }
  return { ok: true };
}

/* ==========================================================================
   Register a new member from the phone app (Birao, Mpandrindra)
   Returns the new ID and PIN so they can be given to the member.
   ========================================================================== */
function addMember_(m, b) {
  if (!rights_(m).members_add) return { ok: false, error: "forbidden" };
  const name = String(b.name || "").trim(), phone = String(b.phone || "").trim();
  const commission = V.commissions.indexOf(b.commission) >= 0 ? b.commission : "";
  const cat = V.feeCategory.indexOf(b.category) >= 0 ? b.category : "";
  if (!name || !phone || !commission || !cat) return { ok: false, error: "missing_fields" };
  if (!phoneIntl_(phone)) return { ok: false, error: "bad_phone" };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const members = rows_("members");
    const digits = phone.replace(/\D/g, "").slice(-9);
    const same = members.find(x => String(x["Finday"]).replace(/\D/g, "").slice(-9) === digits);
    if (same) return { ok: false, error: "exists", id: String(same["ID"]), name: same["Anarana feno"] };
    let max = 0;
    members.forEach(x => { const mm = String(x["ID"]).match(/ZA-(\d+)/); if (mm) max = Math.max(max, Number(mm[1])); });
    const id = "ZA-" + ("00" + (max + 1)).slice(-3);
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const sh = sheet_("members");
    const h = sh.getDataRange().getValues()[0];
    const row = h.map(k => ({
      "ID": id, "Anarana feno": safe_(name, 120), "Daty nahaterahana": b.birth ? dateFrom_(b.birth) : "",
      "Finday": "'" + phone.slice(0, 30), "Vaomiera": commission, "Birao": "Tsia", "Andraikitra Birao": "",
      "Daty niditra": b.joined ? dateFrom_(b.joined) : new Date(), "Sata": "Mavitrika", "Zo": "Mpikambana",
      "PIN": "'" + pin, "Sary": "", "Sokajy": cat
    })[k] ?? "");
    sh.appendRow(row);
    sheet_("log").appendRow([new Date(), m["Anarana feno"], "new_member", id + " " + name, "mem|" + id]);
    return { ok: true, id, pin, name };
  } finally { lock.releaseLock(); }
}
