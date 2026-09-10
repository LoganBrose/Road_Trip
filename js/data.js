/*
  data.js — shared helpers used by every page:
   - fetching + parsing the CSV data (real sheet, or demo fallback)
   - small formatting helpers (dates, money, star ratings)
   - status colors, so the map / itinerary / legend all agree
   - a helper to turn a Google Drive share link into a viewable image URL

  Everything hangs off a single global "App" object so the page-specific
  scripts (map.js, itinerary.js, ...) can use it without needing a build step.
*/
const App = {};

App.STATUS_COLORS = {
  visited: "#2e7d32",   // green
  current: "#f9a825",   // gold
  upcoming: "#1565c0",  // blue
  skipped: "#9e9e9e"    // gray, for anything cancelled/skipped
};

App.normalizeStatus = function (raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (App.STATUS_COLORS[s]) return s;
  if (s.startsWith("visit")) return "visited";
  if (s.startsWith("curr") || s.startsWith("now")) return "current";
  if (s.startsWith("upcom") || s.startsWith("plan")) return "upcoming";
  if (s.startsWith("skip") || s.startsWith("cancel")) return "skipped";
  return "upcoming";
};

App.statusColor = function (raw) {
  return App.STATUS_COLORS[App.normalizeStatus(raw)];
};

App.statusLabel = function (raw) {
  const s = App.normalizeStatus(raw);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

App.isDemoUrl = function (url) {
  return !url || url.indexOf("PASTE_YOUR") !== -1;
};

// True if none of the three sheet URLs have been filled in yet.
App.inDemoMode = function () {
  return App.isDemoUrl(CONFIG.STOPS_CSV_URL) &&
         App.isDemoUrl(CONFIG.SPENDING_CSV_URL) &&
         App.isDemoUrl(CONFIG.PHOTOS_CSV_URL);
};

/*
  Fetches and parses a CSV. If the configured URL is still the placeholder,
  or the fetch fails for any reason, falls back to the bundled demo CSV so
  the site never shows a blank page.
*/
App.loadCSV = function (configUrl, demoPath) {
  const url = App.isDemoUrl(configUrl) ? null : configUrl;
  const finalUrl = url ? (url + (url.indexOf("?") === -1 ? "?" : "&") + "cachebust=" + Date.now()) : demoPath;

  return new Promise((resolve) => {
    Papa.parse(finalUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve({ rows: results.data, usedDemo: !url }),
      error: () => {
        // Real sheet failed to load (bad URL, not published, offline...) — fall back to demo data.
        Papa.parse(demoPath, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve({ rows: results.data, usedDemo: true, fetchFailed: !!url }),
          error: () => resolve({ rows: [], usedDemo: true, fetchFailed: true })
        });
      }
    });
  });
};

App.loadStops = () => App.loadCSV(CONFIG.STOPS_CSV_URL, "data/demo-stops.csv").then((r) => {
  r.rows = r.rows
    .filter((row) => row.name && String(row.name).trim())
    .map((row) => ({
      name: (row.name || "").trim(),
      state: (row.state || "").trim(),
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      arrival_date: (row.arrival_date || "").trim(),
      nights: row.nights === "" || row.nights == null ? null : Number(row.nights),
      status: App.normalizeStatus(row.status),
      mileage: row.mileage === "" || row.mileage == null ? null : Number(row.mileage),
      accommodation: (row.accommodation || "").trim(),
      activity: (row.activity || "").trim(),
      rating: row.rating === "" || row.rating == null ? null : Number(row.rating),
      weather: (row.weather || "").trim(),
      notes: (row.notes || "").trim()
    }))
    .sort((a, b) => App.parseDate(a.arrival_date) - App.parseDate(b.arrival_date));
  return r;
});

App.loadSpending = () => App.loadCSV(CONFIG.SPENDING_CSV_URL, "data/demo-spending.csv").then((r) => {
  r.rows = r.rows
    .filter((row) => row.date && String(row.date).trim())
    .map((row) => ({
      date: (row.date || "").trim(),
      stop: (row.stop || "").trim(),
      category: (row.category || "Other").trim() || "Other",
      amount: parseFloat(row.amount) || 0,
      notes: (row.notes || "").trim()
    }))
    .sort((a, b) => App.parseDate(a.date) - App.parseDate(b.date));
  return r;
});

App.loadPhotos = () => App.loadCSV(CONFIG.PHOTOS_CSV_URL, "data/demo-photos.csv").then((r) => {
  r.rows = r.rows
    .filter((row) => row.photo_url && String(row.photo_url).trim())
    .map((row) => ({
      stop: (row.stop || "").trim(),
      date: (row.date || "").trim(),
      photo_url: (row.photo_url || "").trim(),
      caption: (row.caption || "").trim()
    }))
    .sort((a, b) => App.parseDate(a.date) - App.parseDate(b.date));
  return r;
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
