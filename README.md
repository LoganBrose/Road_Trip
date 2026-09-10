# Road Trip Tracker

A little website that tracks a road trip across the country: an interactive
map, a day-by-day itinerary, a spending & budget summary, and a photo
gallery. You update everything from your phone by editing a Google Sheet —
the website reads that sheet live, so there's nothing to "publish" or
redeploy after the initial setup.

This README is written for someone who has never built a website before,
and it's meant to still make sense if you come back to this project in a
year and have forgotten everything. Read it top to bottom once, then keep
it around as a reference.

**Live site:** once GitHub Pages is enabled for this repo (see section 6),
your site is at `https://loganbrose.github.io/Road_Trip/` (exact URL is
also shown on the GitHub Pages settings page).

**Current status:** the site is already connected to a real Google Sheet
(see `js/config.js`) — you don't need to do the sheet-connection steps
below unless you're reconnecting it, understanding how it works, or setting
this up again from scratch a year from now.

---

## Contents

1. [How this works, in plain language](#1-how-this-works-in-plain-language)
2. [What's in this repository](#2-whats-in-this-repository)
3. [Your Google Sheet's structure](#3-your-google-sheets-structure)
4. [How the site is connected to the sheet](#4-how-the-site-is-connected-to-the-sheet)
5. [Reconnecting or adding a tab (getting a new gid)](#5-reconnecting-or-adding-a-tab-getting-a-new-gid)
6. [Host it for free (GitHub Pages)](#6-host-it-for-free-github-pages)
7. [Updating the trip from your phone](#7-updating-the-trip-from-your-phone)
8. [Adding photos](#8-adding-photos)
9. [Customizing](#9-customizing)
10. [Troubleshooting](#10-troubleshooting)
11. [Previewing changes on a computer](#11-previewing-changes-on-a-computer)
12. [Glossary](#12-glossary)

---

## 1. How this works, in plain language

There is no "backend," no database, and no app to install. It's three things:

- **Your Google Sheet** — the tabs you edit from the Google Sheets app on
  your phone, same as any spreadsheet: `Stops`, `Spending`, `Budget`, and
  `Photos` feed the site. (You likely also have `Candidates` and `Gear`
  tabs for your own planning — the site ignores those on purpose.)
- **This website** — a handful of plain HTML/CSS/JavaScript files. It has no
  build step; nothing gets "compiled." A browser can open these files directly.
- **GitHub Pages** — a free service that takes the files in this repository
  and serves them at a public URL, so your family can open a link and see
  the site.

When someone opens the site, the JavaScript in their browser fetches your
Google Sheet's data (as CSV, a simple text format) directly from Google's
servers and draws the map/itinerary/spending/photos from it. That means:

- You never touch code to log a new stop — you just edit the spreadsheet.
- The site always shows current data, because it re-fetches the sheet every
  time someone loads a page.
- Google's "publish to web" cache means changes can take a few minutes to
  show up (more on this in [section 7](#7-updating-the-trip-from-your-phone)).

---

## 2. What's in this repository

```
Road_Trip/
├── index.html          Home page: the map, pin legend, trip stats
├── itinerary.html       Chronological list of every stop
├── spending.html         Spending totals, category chart, budget table, transactions
├── gallery.html          Photo gallery, grouped by stop
├── css/
│   └── style.css        All the site's styling (one file, used by every page)
├── js/
│   ├── config.js         *** THE FILE YOU EDIT *** — your sheet's URLs & settings
│   ├── data.js           Shared helpers: fetching/parsing the sheet, formatting
│   ├── map.js            Logic just for index.html
│   ├── itinerary.js      Logic just for itinerary.html
│   ├── spending.js       Logic just for spending.html
│   └── gallery.js        Logic just for gallery.html
├── data/
│   └── demo-*.csv        Sample data so the site works before/without a sheet
└── vendor/               Copies of the 3rd-party code libraries the site uses
    ├── leaflet/           Draws the interactive map
    ├── papaparse.min.js   Reads the CSV data from your sheet
    └── chart.umd.js       Draws the spending pie chart
```

`vendor/` holds real copies of these libraries (not links to the internet).
That's deliberate: it means the site keeps working even if some CDN goes
down or changes its URLs years from now, and it's one less thing to
understand. You never need to touch this folder.

If `js/config.js` ever points at demo data (or a sheet fails to load), the
site falls back to the sample CSVs in `data/` and shows a banner saying so
— it never just shows a blank page.

---

## 3. Your Google Sheet's structure

The real sheet isn't a simple "row 1 = headers" spreadsheet — each tab has
a title row and a summary row above the actual column headers. The site
knows to skip those two rows and start reading from row 3 (or row 4/5 on
the planning-only tabs). If you're recreating this sheet from scratch, or
just want to know what the site expects, here's the exact layout:

### `Stops` — headers on row 3, data starts row 4

| Stop Name | State | Latitude | Longitude | Arrival Date | Nights | Status | Miles From Previous | Drive Hours | Accommodation | Main Activity | Rating (1-5) | Weather | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **Latitude / Longitude** — decimal degrees (longitude negative for the
  western US). Easiest way to get these: search the place on Google Maps,
  right-click the pin, tap the coordinates that pop up (copies them).
- **Arrival Date** — `YYYY-MM-DD` format.
- **Status** — one of `Planned` (red), `Current` (yellow — wherever you are
  right now), `Visited` (green), or `Skipped` (grey). This controls the pin
  color on the map (see the legend on the home page) and whether a stop
  counts toward the route line/stats. If your sheet has a dropdown/data
  validation rule on this column, add `Current` as an allowed value there
  too, or typing it will get flagged as invalid input.
- **Miles From Previous** — a number; the site labels it "mi" in the UI.
- **Drive Hours** — usually a formula (`Miles / 60`) in the sheet. If a row
  comes through blank (the formula didn't calculate, or the cell is
  genuinely empty), the site computes it itself the same way — you don't
  need to fix blank Drive Hours cells.
- Any row with a blank **Stop Name** is skipped automatically — safe to
  leave example rows or extra blank rows in the sheet.

### `Spending` — headers on row 3, data starts row 4

| Date | Category | Amount | Stop / Location | Payment Method | Notes |
|---|---|---|---|---|---|

- **Category** — one of `Fuel`, `Lodging`, `Camping`, `Food`, `Park Passes`,
  `Permits`, `Gear`, `Vehicle / Repairs`, `Other` (or whatever you use —
  the category chart builds itself from whatever values appear).
- Rows with a blank **Date** are skipped automatically.

### `Budget` — headers on row 3

| Category | Planned | Actual | Remaining | Notes |
|---|---|---|---|---|

`Actual` is calculated inside the sheet from the `Spending` tab — the site
displays that value as-is and never recalculates it independently. The
Spending page's budget table and progress bar are built entirely from this
tab (total Planned vs. total Actual across all categories).

### `Photos` — headers on row 3, data starts row 4

| Stop Name | Date | Image URL | Caption |
|---|---|---|---|

**Stop Name** must match a Stop Name on the `Stops` tab so the gallery can
group photos correctly. Rows with a blank Stop Name or Image URL are
skipped automatically. See [section 8](#8-adding-photos) for how to get an
Image URL from your phone.

### `Candidates` and `Gear` — not used by the site

These are planning tabs (places you're still deciding on, and gear
shopping list) — the public site deliberately doesn't read them. If you
ever want a "planning" page added for Candidates, that's a bigger change;
ask for it specifically rather than expecting it to just appear.

---

## 4. How the site is connected to the sheet

The whole sheet was published at once (**File → Share → Publish to web →
Entire Document**), which gives every tab a shared "publish ID." Each
individual tab is then addressed by its **gid** — a number that identifies
which tab it is (visible in the sheet's normal edit URL, e.g.
`.../edit?gid=725734293#gid=725734293`).

`js/config.js` builds each tab's CSV URL from that shared ID plus the tab's
gid:

```js
const SHEET_PUBLISH_ID = "2PACX-1vQqv...";

function sheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUBLISH_ID}/pub?gid=${gid}&single=true&output=csv`;
}

const CONFIG = {
  STOPS_CSV_URL: sheetCsvUrl(725734293),
  SPENDING_CSV_URL: sheetCsvUrl(697444775),
  BUDGET_CSV_URL: sheetCsvUrl(463352620),
  PHOTOS_CSV_URL: sheetCsvUrl(1978429405),
  ...
```

Editing the sheet's *contents* never requires touching this file or
redeploying anything — the site re-fetches the CSVs fresh every time
someone loads a page. You only need to change `config.js` if a tab's gid
changes (see next section) or you want to point the site at a different
sheet entirely.

---

## 5. Reconnecting or adding a tab (getting a new gid)

You won't need this often — a tab's gid doesn't change just from editing
rows. You'd only need to redo this if you rename/recreate a tab, unpublish
and republish the whole sheet, or want to point the site at a totally
different spreadsheet.

1. Open the sheet, tap the tab you need (e.g. `Stops`).
2. Look at the URL — it ends in something like `#gid=725734293`. That
   number is the gid.
3. If it's a brand-new spreadsheet (different publish ID, not just a new
   tab on the same one), you also need to re-publish the whole thing:
   **File → Share → Publish to web → Entire Document → Publish**, then
   copy the long ID out of the link it gives you (the part after `/d/e/`
   and before `/pubhtml` or `/pub`).
4. Update `js/config.js` — either the `SHEET_PUBLISH_ID` constant (if the
   whole sheet changed) or the specific gid passed to `sheetCsvUrl(...)`
   for that tab.
5. Commit and push the change. GitHub Pages redeploys automatically.

---

## 6. Host it for free (GitHub Pages)

If you're reading this file on GitHub, you're most of the way there. GitHub
Pages turns this repository into a live website for free.

1. On GitHub, go to this repository's **Settings** tab.
2. In the left sidebar, click **Pages**.
3. Under "Build and deployment," make sure **Source** is set to **"Deploy
   from a branch"** (if it says "GitHub Actions" instead, change it — this
   is the step that's easy to miss).
4. Under "Branch," choose `main` (or whichever branch has these files) and
   folder `/ (root)`. Click **Save**.
5. Wait a minute or two, then refresh the page — GitHub shows the live URL
   at the top, something like `https://loganbrose.github.io/Road_Trip/`.

That URL is what you share with family. Every time you push a change to
this repository, GitHub Pages automatically redeploys it — you don't need
to do anything else. Editing the Google Sheet itself doesn't require a
redeploy at all, since the site fetches the sheet live.

---

## 7. Updating the trip from your phone

Day to day, you'll only ever touch the **Google Sheet**, using the Google
Sheets app (iOS/Android) or sheets.google.com in your phone's browser —
never the code.

- **Heading to/at a stop right now?** Set its `Status` to `Current` — it
  shows as a larger yellow pin and counts toward "so far" stats.
- **Left a stop?** Change its `Status` from `Current` to `Visited` (green)
  once you've moved on.
- **Skipping a planned stop?** Set its `Status` to `Skipped` — it'll show
  grey on the map instead of disappearing.
- **Spent money?** Add a row to the `Spending` tab. The `Budget` tab's
  `Actual` column picks it up automatically (that's the sheet's own
  formula, not something the site does).
- **Took a great photo?** See [section 8](#8-adding-photos).

**One quirk to know:** Google's "publish to web" data is cached and can
take up to about 5 minutes to reflect an edit. If you update the sheet and
the site still shows old data, wait a few minutes and reload (a hard reload
— pull down to refresh, or reload the browser tab). This is normal and not
a bug.

**A different quirk, for code changes specifically:** browsers cache
`css/style.css` and the files in `js/` fairly aggressively. Every `<link>`
and `<script>` tag in the HTML files points at these with a `?v=5` on the
end — if you (or I) edit any CSS/JS file and things don't look updated,
bump that number (e.g. `?v=6`) in all four HTML files so browsers are
forced to fetch the new version instead of an old cached copy. The
surest way to check if that's the problem: open the site in a Private/
Incognito tab, which never uses the cache.

---

## 8. Adding photos

Photos need to live somewhere on the internet with a link the site can
load as an image — the spreadsheet only stores the *link*, not the photo
itself. The simplest option that works entirely from your phone:

1. Upload the photo to **Google Drive** (the Drive app has a straightforward
   "upload" / share-from-Photos-app flow).
2. In Drive, tap the photo, then **Share → General access → change to
   "Anyone with the link."** (It only needs to be viewable, not editable.)
3. Tap **Copy link**.
4. Paste that link into the **Image URL** column in the `Photos` tab, along
   with the **Stop Name** (must match the Stops tab), **Date**, and an
   optional **Caption**.

The site automatically converts a normal Drive share link into a viewable
image behind the scenes (see `driveImageUrl` in `js/data.js` if you're
curious how). No need to reformat the link yourself.

**If Drive images ever stop loading** (Google occasionally changes how it
serves shared files, or a link's sharing gets reset to private), the
fallback is any other image host that gives you a direct link ending in
something like `.jpg` — Imgur is a common free option. Paste that link into
Image URL instead; the site displays it as-is if it doesn't look like a
Drive link.

---

## 9. Customizing

A few things you might want to tweak, and where to find them:

- **Status colors / pin colors** — `App.STATUS_COLORS` near the top of
  `js/data.js`, and the matching CSS variables (`--visited`, `--current`,
  `--planned`, `--skipped`) in `css/style.css`. Currently: visited=green,
  current=yellow, planned=red, skipped=grey.
- **Map's starting position/zoom** — `MAP_START_VIEW` in `js/config.js`.
  (The map auto-zooms to fit your pins anyway, so this is just what shows
  for a split second before that happens.)
- **The dark map tiles** — `js/map.js`, the `L.tileLayer(...)` call. It
  currently uses CARTO's free "Dark Matter" tiles; swapping in a different
  free tile provider just means changing that one URL and attribution line.
- **Overall look** (dark theme colors, fonts, spacing) — CSS variables at
  the top of `css/style.css`, under `:root`. `--bg`/`--bg-deep` are the
  near-black/dark-navy backgrounds, `--surface` is the card color, `--accent`
  is the navy-blue used for links/buttons/active nav.
- **Site title** — `TRIP_NAME` in `js/config.js`.
- **Adding a new status** — add it to `STATUS_COLORS` in `js/data.js`, its
  matching rule in `App.normalizeStatus`, and a legend entry in `index.html`.

---

## 10. Troubleshooting

**The map/itinerary/spending/gallery is blank, or shows the demo banner
even though the sheet is connected.**
Double-check `js/config.js` — each gid must match the tab it's meant to
(open the tab in the sheet and compare the URL's gid). Also confirm the
whole sheet is still published: **File → Share → Publish to web** — it's
possible publishing got turned off, or a "stop publishing" click reset it.

**The site shows old data after I edited the sheet.**
Wait ~5 minutes (Google's publish cache) and do a hard refresh. If it's
been much longer than that, re-check that the sheet is still published.

**A row I added isn't showing up.**
Check it landed *below* the header row for that tab (row 4 on Stops/
Spending/Photos, row 3 data rows on Budget) and that the key column isn't
blank — Stop Name for Stops/Photos, Date for Spending, Category for Budget.
Blank-key rows are filtered out on purpose (so leftover example rows don't
show up), which means a genuinely new row needs that column filled in too.

**A photo won't load (broken image icon).**
Usually the Drive file's sharing isn't set to "Anyone with the link," or it
got reset. Reopen it in Drive and check. See [section 8](#8-adding-photos)
for the Imgur fallback.

**A pin is in the wrong place, or missing.**
Check that Latitude/Longitude in the Stops tab are plain decimal numbers
(not something like `37°17'53"N`), and that Latitude isn't accidentally
swapped with Longitude (longitude should be negative for anywhere in the US).

**Drive Hours or Miles look off.**
Miles From Previous is whatever you typed in. Drive Hours either comes from
the sheet's own formula or, if that cell is blank, gets computed by the
site as Miles ÷ 60 — so a blank-looking Drive Hours cell in the sheet is
normal and not a bug.

**I broke something in the code and want to undo it.**
Every change is saved in GitHub's history. Go to this repository's
"Commits" list, find the last version that worked, and you can view or
revert to it from there. You cannot break the Google Sheet data by editing
code, and you cannot break the code by editing the Google Sheet — they're
independent, which makes this hard to truly break.

---

## 11. Previewing changes on a computer

You'll do almost everything from your phone via the Google Sheet, but if
you ever edit the code itself (colors, text, etc.) on a computer, you can
preview it before pushing:

1. Open a terminal in this folder.
2. Run: `python3 -m http.server 8000`
3. Open `http://localhost:8000` in a browser.

That's it — no installation, no build step. Stop the server with Ctrl+C
when you're done.

---

## 12. Glossary

A few terms used above, if any of this is new:

- **Repository ("repo")** — the folder of files that makes up this project,
  tracked by Git/GitHub so changes are saved with history.
- **CSV** — "comma-separated values," a plain-text way of representing a
  spreadsheet. Google Sheets can export any tab as one.
- **gid** — the number Google Sheets uses to identify one tab within a
  spreadsheet. Visible in the URL whenever that tab is open.
- **CDN / vendored library** — code someone else wrote (like the map
  library) that this site uses. "Vendored" means a copy of it lives in this
  repo's `vendor/` folder instead of being fetched from the internet each
  time.
- **GitHub Pages** — GitHub's free static website hosting, used here to
  turn this repository into a live URL.
- **Publish to web** — a Google Sheets feature that creates a public,
  read-only, auto-updating link to a sheet (or one tab of it).
