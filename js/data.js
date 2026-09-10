/*
  data.js — shared helpers used by every page:
   - fetching + parsing the CSV data (real sheet, or demo fallback)
   - handling the title/summary rows Google Sheets export above the real headers
   - small formatting helpers (dates, money, star ratings)
   - status colors, so the map / itinerary / legend all agree
   - a helper to turn a Google Drive share link into a viewable image URL

  Everything hangs off a single global "App" object so the page-specific
  scripts (map.js, itinerary.js, ...) can use it without needing a build step.
*/
const App = {};

// The sheet's real header row is row 3 on every tab that feeds the site
// (rows 1-2 are a title row and a summary row) — see README.md section 3.
const HEADER_ROW_INDEX = 2; // 0-based: row 3

App.STATUS_COLORS = {
  visited: "#3fae5a",  // green
  current: "#f2c94c",  // yellow
  planned: "#e0524d",  // red
  skipped: "#7d8494"   // muted grey
};

// All four status colors are mid-tone enough that dark text reads better
// on them than white does (checked contrast on each) — so badges/pins
// always get dark text rather than switching per status.
const STATUS_BADGE_TEXT = "#14161a";

App.normalizeStatus = function (raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (App.STATUS_COLORS[s]) return s;
  if (s.startsWith("visit")) return "visited";
  if (s.startsWith("curr") || s.startsWith("now")) return "current";
  if (s.startsWith("skip") || s.startsWith("cancel")) return "skipped";
  if (s.startsWith("plan")) return "planned";
  return "planned";
};

App.statusColor = function (raw) {
  return App.STATUS_COLORS[App.normalizeStatus(raw)];
};

App.statusTextColor = function () {
  return STATUS_BADGE_TEXT;
};

App.statusLabel = function (raw) {
  const s = App.normalizeStatus(raw);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

App.isDemoUrl = function (url) {
  return !url || url.indexOf("PASTE_YOUR") !== -1;
};

// A tab's CONFIG entry is a list of candidate URLs to try in order (see js/config.js).
// This filters out anything unusable, leaving only real, fetchable URLs.
App.realUrls = function (urlOrUrls) {
  const list = Array.isArray(urlOrUrls) ? urlOrUrls : (urlOrUrls ? [urlOrUrls] : []);
  return list.filter((u) => !App.isDemoUrl(u));
};

App.inDemoMode = function () {
  return App.realUrls(CONFIG.STOPS_CSV_URL).length === 0 &&
         App.realUrls(CONFIG.SPENDING_CSV_URL).length === 0 &&
         App.realUrls(CONFIG.PHOTOS_CSV_URL).length === 0 &&
         App.realUrls(CONFIG.BUDGET_CSV_URL).length === 0;
};

// Turns "$1,234.56" or "42 mi" or "" into a clean number, or null if there's nothing usable.
App.toNumber = function (v) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

/*
  Fetches a tab's data — trying each candidate URL in turn (see
  App.realUrls; typically a gviz URL then a pub URL as backup) before
  falling back to the bundled demo CSV — parses the whole thing into a 2D
  array of rows, then splits it into { headers, dataRows } using
  headerRowIndex. That's how we skip the title/summary rows that sit above
  the real header row on every tab.
*/
App.loadSheetTab = function (csvUrlOrUrls, demoPath, headerRowIndex) {
  const candidates = App.realUrls(csvUrlOrUrls);
  const parseText = (text) => Papa.parse(text, { skipEmptyLines: false }).data;

  const fetchDemo = () => fetch(demoPath).then((r) => r.text()).then((text) => ({
    table: parseText(text), usedDemo: true, fetchFailed: candidates.length > 0
  }));

  const tryUrl = (url) => {
    const target = url + (url.indexOf("?") === -1 ? "?" : "&") + "cachebust=" + Date.now();
    return fetch(target).then((r) => {
      if (!r.ok) throw new Error("bad status " + r.status);
      return r.text();
    });
  };

  const tryNext = (i) => {
    if (i >= candidates.length) return fetchDemo();
    return tryUrl(candidates[i])
      .then((text) => ({ table: parseText(text), usedDemo: false }))
      .catch(() => tryNext(i + 1));
  };

  return tryNext(0).then(({ table, usedDemo, fetchFailed }) => {
    const headers = (table[headerRowIndex] || []).map((h) => String(h || "").trim());
    const dataRows = table.slice(headerRowIndex + 1);
    return { headers, dataRows, usedDemo, fetchFailed };
  });
};

// Maps one raw CSV row (an array of cell strings) to a plain object using
// a list of { key, match } definitions, where `match` is a regex tested
// against each (trimmed) header cell to find the right column.
App.mapRow = function (headers, rowArr, fieldDefs) {
  const obj = {};
  fieldDefs.forEach(({ key, match }) => {
    const idx = headers.findIndex((h) => match.test(h));
    const raw = idx === -1 ? "" : rowArr[idx];
    obj[key] = raw == null ? "" : String(raw).trim();
  });
  return obj;
};

const STOPS_FIELDS = [
  { key: "name", match: /^stop name$/i },
  { key: "state", match: /^state$/i },
  { key: "latitude", match: /^lat/i },
  { key: "longitude", match: /^long/i },
  { key: "arrival_date", match: /^arrival date$/i },
  { key: "nights", match: /^nights$/i },
  { key: "status", match: /^status$/i },
  { key: "mileage", match: /^miles/i },
  { key: "drive_hours", match: /^drive hours$/i },
  { key: "accommodation", match: /^accommodation$/i },
  { key: "activity", match: /^main activity$/i },
  { key: "rating", match: /^rating/i },
  { key: "weather", match: /^weather$/i },
  { key: "notes", match: /^notes$/i }
];

const SPENDING_FIELDS = [
  { key: "date", match: /^date$/i },
  { key: "category", match: /^category$/i },
  { key: "amount", match: /^amount$/i },
  { key: "stop", match: /^stop/i }, // "Stop / Location"
  { key: "payment_method", match: /^payment/i },
  { key: "notes", match: /^notes$/i }
];

const PHOTOS_FIELDS = [
  { key: "stop", match: /^stop name$/i },
  { key: "date", match: /^date$/i },
  { key: "photo_url", match: /^image url$/i },
  { key: "caption", match: /^caption$/i }
];

const BUDGET_FIELDS = [
  { key: "category", match: /^category$/i },
  { key: "planned", match: /^planned$/i },
  { key: "actual", match: /^actual$/i },
  { key: "remaining", match: /^remaining$/i },
  { key: "notes", match: /^notes$/i }
];

App.loadStops = () => App.loadSheetTab(CONFIG.STOPS_CSV_URL, "data/demo-stops.csv", HEADER_ROW_INDEX)
  .then(({ headers, dataRows, usedDemo }) => {
    const rows = dataRows
      .map((r) => App.mapRow(headers, r, STOPS_FIELDS))
      .filter((o) => o.name) // skip example/blank rows (no Stop Name)
      .map((o) => {
        const mileage = App.toNumber(o.mileage);
        let driveHours = App.toNumber(o.drive_hours);
        if (driveHours == null && mileage != null) {
          driveHours = Math.round((mileage / 60) * 10) / 10; // matches the sheet's own Miles/60 formula
        }
        return {
          name: o.name,
          state: o.state,
          latitude: App.toNumber(o.latitude),
          longitude: App.toNumber(o.longitude),
          arrival_date: o.arrival_date,
          nights: App.toNumber(o.nights),
          status: App.normalizeStatus(o.status),
          mileage: mileage,
          drive_hours: driveHours,
          accommodation: o.accommodation,
          activity: o.activity,
          rating: App.toNumber(o.rating),
          weather: o.weather,
          notes: o.notes
        };
      })
      .sort((a, b) => App.parseDate(a.arrival_date) - App.parseDate(b.arrival_date));
    return { rows, usedDemo };
  });

App.loadSpending = () => App.loadSheetTab(CONFIG.SPENDING_CSV_URL, "data/demo-spending.csv", HEADER_ROW_INDEX)
  .then(({ headers, dataRows, usedDemo }) => {
    const rows = dataRows
      .map((r) => App.mapRow(headers, r, SPENDING_FIELDS))
      .filter((o) => o.date) // skip empty rows below the real data
      .map((o) => ({
        date: o.date,
        stop: o.stop,
        category: o.category || "Other",
        amount: App.toNumber(o.amount) || 0,
        payment_method: o.payment_method,
        notes: o.notes
      }))
      .sort((a, b) => App.parseDate(a.date) - App.parseDate(b.date));
    return { rows, usedDemo };
  });

App.loadPhotos = () => App.loadSheetTab(CONFIG.PHOTOS_CSV_URL, "data/demo-photos.csv", HEADER_ROW_INDEX)
  .then(({ headers, dataRows, usedDemo }) => {
    const rows = dataRows
      .map((r) => App.mapRow(headers, r, PHOTOS_FIELDS))
      .filter((o) => o.stop && o.photo_url) // skip example/blank rows
      .sort((a, b) => App.parseDate(a.date) - App.parseDate(b.date));
    return { rows, usedDemo };
  });

App.loadBudget = () => App.loadSheetTab(CONFIG.BUDGET_CSV_URL, "data/demo-budget.csv", HEADER_ROW_INDEX)
  .then(({ headers, dataRows, usedDemo }) => {
    const rows = dataRows
      .map((r) => App.mapRow(headers, r, BUDGET_FIELDS))
      .filter((o) => o.category)
      .map((o) => ({
        category: o.category,
        planned: App.toNumber(o.planned) || 0,
        actual: App.toNumber(o.actual) || 0,   // calculated in the sheet from Spending — never recomputed here
        remaining: App.toNumber(o.remaining),
        notes: o.notes
      }));
    return { rows, usedDemo };
  });

App.parseDate = function (str) {
  if (!str) return new Date(0);
  const d = new Date(str);
  return isNaN(d) ? new Date(0) : d;
};

App.formatDate = function (str) {
  const d = App.parseDate(str);
  if (!str || isNaN(d) || d.getTime() === 0) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

App.formatMoney = function (n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

App.ratingStars = function (n) {
  if (!n) return "";
  const full = Math.round(n);
  return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
};

/*
  Turns a Google Drive "share" link into a URL that can actually be used as an
  <img src>. Handles the common link shapes Drive produces. Anything that
  isn't a Drive link (e.g. an Imgur or direct .jpg URL) is passed through as-is.
*/
App.driveImageUrl = function (url, width) {
  if (!url) return url;
  const w = width || 1000;
  let id = null;
  let m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) id = m[1];
  if (!id) {
    m = url.match(/[?&]id=([^&]+)/);
    if (m) id = m[1];
  }
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${w}`;
  return url;
};

// Small DOM helpers
App.$ = (sel, ctx) => (ctx || document).querySelector(sel);
App.$$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

App.el = function (tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
};

// Shows the little "you're viewing demo data" banner when applicable, and wires the nav's active link.
App.initPageChrome = function (usedDemoFlags) {
  App.$$(".nav-link").forEach((a) => {
    if (a.getAttribute("href") === location.pathname.split("/").pop() ||
        (a.getAttribute("href") === "index.html" && (location.pathname.endsWith("/") || location.pathname.split("/").pop() === ""))) {
      a.classList.add("active");
    }
  });

  const anyDemo = (usedDemoFlags || []).some(Boolean);
  if (anyDemo) {
    const banner = App.el("div", { class: "demo-banner" }, [
      "You're viewing demo data. Connect your Google Sheet in ",
      App.el("code", {}, ["js/config.js"]),
      " to show your real trip. See the README for step-by-step instructions."
    ]);
    document.body.insertBefore(banner, document.body.firstChild);
  }
};
