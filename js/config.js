/*
  CONFIG — connects the site to your real Google Sheet.

  These URLs read directly from the published sheet (id 2PACX-1vQqv...),
  one per tab, using each tab's "gid" (the number that identifies a tab —
  visible in the address bar when that tab is open in Google Sheets).

  If you ever add a new tab or need to reconnect one, see README.md
  section 5 for how to find a tab's gid and rebuild its URL.
*/
const SHEET_PUBLISH_ID = "2PACX-1vQqvcJs71KvJB69qL7LdRgH8eVY6fjn398AUqWAggEuWffbzJo_MpiuiURTR0tjsjsUiPA3gbZGdlfM";

function sheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUBLISH_ID}/pub?gid=${gid}&single=true&output=csv`;
}

const CONFIG = {
  STOPS_CSV_URL: sheetCsvUrl(725734293),
  SPENDING_CSV_URL: sheetCsvUrl(697444775),
  BUDGET_CSV_URL: sheetCsvUrl(463352620),
  PHOTOS_CSV_URL: sheetCsvUrl(1978429405),

  // Where the map centers/zooms before any pins have loaded. Default is roughly the western US —
  // adjust if your route is centered elsewhere.
  MAP_START_VIEW: { lat: 39.5, lng: -98.5, zoom: 4 },

  TRIP_NAME: "Our Road Trip"
};
