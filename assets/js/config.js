/* ==========================================================
   ZA SPaFI Toliara – site settings
   Edit the values below. Text in [brackets] must be completed.
   ========================================================== */
window.SITE_CONFIG = {
  // URL of the Google Apps Script web app (phase 2).
  // While empty, the site shows the sample data in data/sample-public.json.
  API_URL: "https://script.google.com/macros/s/AKfycbyxZfX-hMj9w1HdI7zHTTrZ4sCCZF-NxDSFVkwq18A57jCCk2d3jteQITrn9ygGtzw6/exec",

  // Default language: "mg" (Malagasy), "fr" (French) or "en" (English)
  DEFAULT_LANG: "mg",

  // Mobile money (owned by the treasurer)
  MOBILE_MONEY: [
    { operator: "MVola", number: "+261 34 94 150 05", holder: "Manampitahiana Aroniaina" }
    // Add more if needed, e.g.:
    // { operator: "Orange Money", number: "032 00 000 00", holder: "[...]" }
  ],

  // Official information shown on the "About us" page
  OFFICIAL: {
    church:   "[Fiangonana Loterana Malagasy – Fitandremana ...]",
    synod:    "Synodam-Paritany Fisakana",
    reg:      "",   // leave empty until the association has its official récépissé number
    address:  "Toliara",
    contact:  "",
    email:    "zaspafi.toliara601@gmail.com",
    facebook: ""   // e.g. "https://www.facebook.com/..."
  },

  // Commissions (Vaomiera) shown on the "About us" page
  COMMISSIONS: ["Soratra Masina", "Fifandraisana", "Fitaovana", "Fampandrosoana", "Hira sy mozika"],

  // PDF documents (put the files in the docs/ folder)
  DOCS: {
    statutes: "docs/sata.pdf",
    rules:    "docs/fitsipika-anatiny.pdf"
  },

  // Number of donations shown before "See the full list"
  DONATIONS_PREVIEW: 10
};
