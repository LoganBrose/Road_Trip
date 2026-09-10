/*
  CONFIG — the only file you need to edit to connect this site to YOUR Google Sheet.

  How to get each URL is explained in README.md under "Connect your Google Sheet".
  Short version: File > Share > Publish to web, pick the tab, pick CSV, copy the link.

  Until you paste real links below, the site automatically shows demo data from the
  /data folder so you can see everything working first.
*/
const CONFIG = {
  STOPS_CSV_URL: "PASTE_YOUR_STOPS_PUBLISHED_CSV_URL_HERE",
  SPENDING_CSV_URL: "PASTE_YOUR_SPENDING_PUBLISHED_CSV_URL_HERE",
  PHOTOS_CSV_URL: "PASTE_YOUR_PHOTOS_PUBLISHED_CSV_URL_HERE",

  // Optional: your total trip budget in dollars, e.g. 6000. Set to null to hide the budget bar.
  TRIP_BUDGET: null,

  // Where the map centers/zooms before any pins have loaded. Default is roughly the western US.
  MAP_START_VIEW: { lat: 39.5, lng: -111.5, zoom: 5 },

  TRIP_NAME: "Our Western US Road Trip"
};
