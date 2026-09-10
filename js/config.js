/*
  CONFIG — connects the site to your real Google Sheet.

  Each tab is read from two possible URLs (the site tries the first, and
  falls back to the second if that one doesn't work): the "gviz" endpoint,
  which is Google's format specifically meant to be read by other websites,
  and the "pub" (publish to web) endpoint as a backup.

  Both need the tab's "gid" (the number that identifies a tab — visible in
  the address bar when that tab is open in Google Sheets). See README.md
  section 5 for how to find a tab's gid if you ever need to reconnect one.
*/
const SPREADSHEET_ID = "1YYjggCBdeqt18FNfIrf2PY0yiStwqxf311-ORHElxsg";
const SHEET_PUBLISH_ID = "2PACX-1vQqvcJs71KvJB69qL7LdRgH8eVY6fjn398AUqWAggEuWffbzJo_MpiuiURTR0tjsjsUiPA3gbZGdlfM";

function sheetCsvUrls(gid) {
  return [
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/e/${SHEET_PUBLISH_ID}/pub?gid=${gid}&single=true&output=csv`
  ];
}

const CONFIG = {
  STOPS_CSV_URL: sheetCsvUrls(725734293),
  SPENDING_CSV_URL: sheetCsvUrls(697444775),
  BUDGET_CSV_URL: sheetCsvUrls(463352620),
  PHOTOS_CSV_URL: sheetCsvUrls(1978429405),

  // Where the map centers/zooms before any pins have loaded. Default is roughly the western US —
  // adjust if your route is centered elsewhere.
  MAP_START_VIEW: { lat: 39.5, lng: -98.5, zoom: 4 },

  TRIP_NAME: "Our Road Trip"
};
