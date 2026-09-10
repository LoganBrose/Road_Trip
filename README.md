# Road Trip Tracker

A little website that tracks a six-week road trip across the western US: an
interactive map, a day-by-day itinerary, a spending summary, and a photo
gallery. You update everything from your phone by editing a Google Sheet —
the website reads that sheet live, so there's nothing to "publish" or
redeploy after the initial setup.

This README is written for someone who has never built a website before,
and it's meant to still make sense if you come back to this project in a
year and have forgotten everything. Read it top to bottom once, then keep
it around as a reference.

**Live site:** once you've done the "Host it for free" step below, your
site will be at `https://loganbrose.github.io/Road_Trip/` (exact URL is
also shown on the GitHub Pages settings page — see below).

---

## Contents

1. [How this works, in plain language](#1-how-this-works-in-plain-language)
2. [What's in this repository](#2-whats-in-this-repository)
3. [Create your Google Sheet](#3-create-your-google-sheet)
4. [Publish the sheet so the site can read it](#4-publish-the-sheet-so-the-site-can-read-it)
5. [Connect the site to your sheet](#5-connect-the-site-to-your-sheet)
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

- **Your Google Sheet** — three tabs (Stops, Spending, Photos) that you edit
  from the Google Sheets app on your phone, same as any spreadsheet.
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
├── spending.html         Spending totals, category chart, transaction table
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
│   └── demo-*.csv        Sample data so the site works before you connect a sheet
└── vendor/               Copies of the 3rd-party code libraries the site uses
    ├── leaflet/           Draws the interactive map
    ├── papaparse.min.js   Reads the CSV data from your sheet
    └── chart.umd.js       Draws the spending pie chart
```

`vendor/` holds real copies of these libraries (not links to the internet).
That's deliberate: it means the site keeps working even if some CDN goes
down or changes its URLs years from now, and it's one less thing to
understand. You never need to touch this folder.

**Right now, with no setup, the site already works** — it shows demo data
from `data/*.csv` with a banner across the top saying so. That's on purpose,
so you can see it running before doing anything else. Sections 3–6 below
walk through replacing that demo data with your real trip.

---

## 3. Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it something like "Road Trip Data."
2. By default it has one tab called "Sheet1." You need **three tabs**,
   named and structured exactly like this (right-click a tab at the bottom
   to rename or add one):

### Tab 1: `Stops`

Row 1 must have these exact column headers (lowercase, no spaces — copy them
exactly):

| name | state | latitude | longitude | arrival_date | nights | status | mileage | accommodation | activity | rating | weather | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **name** — e.g. `Zion National Park`
- **state** — two-letter code, e.g. `UT`
- **latitude** / **longitude** — decimal numbers, e.g. `37.2982` and
  `-113.0263`. Easiest way to get these: search the place on Google Maps,
  right-click the pin, click the coordinates that pop up (it copies them),
  then paste the first number into latitude and the second into longitude.
- **arrival_date** — e.g. `2026-06-10` (year-month-day is safest; avoid
  just typing `6/10` since Sheets can guess the wrong year)
- **nights** — a number, e.g. `2`
- **status** — one of `Visited`, `Current`, `Upcoming`, or `Skipped`
  (controls the pin color — see the legend on the home page)
- **mileage** — miles driven to reach this stop, a number
- **accommodation** — free text, e.g. `Cabin near park entrance`
- **activity** — free text, e.g. `Angels Landing hike`
- **rating** — a number 1–5 (shown as stars); leave blank until you've been
- **weather** — free text, e.g. `Hot 92F`; leave blank until you've been
- **notes** — anything else, free text

Add one row per stop, in any order — the site sorts them by `arrival_date`
automatically. Leave `rating`, `weather`, and `notes` blank for stops you
haven't reached yet.

### Tab 2: `Spending`

Row 1 headers:

| date | stop | category | amount | notes |
|---|---|---|---|---|

- **date** — e.g. `2026-06-10`
- **stop** — should match a `name` from the Stops tab (not required, but
  keeps things tidy)
- **category** — e.g. `Lodging`, `Food`, `Gas`, `Activities`. Use whatever
  categories make sense to you — the spending page automatically builds its
  chart from whatever categories appear.
- **amount** — a plain number, e.g. `64.50` (no dollar sign)
- **notes** — free text

Add one row per purchase, or per day if you'd rather log totals than every
receipt.

### Tab 3: `Photos`

Row 1 headers:

| stop | date | photo_url | caption |
|---|---|---|---|

- **stop** — should match a `name` from the Stops tab, so the gallery can
  group photos correctly
- **date** — e.g. `2026-06-10`
- **photo_url** — a link to the photo (see [section 8](#8-adding-photos) for
  exactly how to get this from your phone)
- **caption** — free text

---

## 4. Publish the sheet so the site can read it

The website can't read a private Google Sheet directly — you have to
"publish" it, which creates a public, read-only, auto-updating link for
each tab. This does **not** make the sheet editable by strangers, and you
can un-publish at any time. It does mean anyone with the link can view that
data, which is the tradeoff for this being free and having no backend.

Do this once per tab (three times total):

1. Open your sheet. **File → Share → Publish to web.**
2. In the dialog, there are two dropdowns. Set the **first one** to the
   specific tab (e.g. "Stops") — not "Entire Document."
3. Set the **second dropdown** to **"Comma-separated values (.csv)."**
4. Click **Publish**, confirm if asked.
5. Copy the link it gives you. It looks like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv`
6. Repeat for the Spending tab and the Photos tab (selecting each in the
   first dropdown, CSV in the second).

You should end up with three different URLs. Save them somewhere (a Notes
app, or paste them right into `config.js` as described next).

---

## 5. Connect the site to your sheet

Open `js/config.js` in this repository (click it on GitHub, then the pencil
"edit" icon) and replace the three placeholder strings with the three URLs
from the previous step:

```js
const CONFIG = {
  STOPS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
  SPENDING_CSV_URL: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
  PHOTOS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
  ...
```

Commit the change (GitHub's web editor will prompt you for a commit
message — anything like "Connect my Google Sheet" is fine). Once GitHub
Pages redeploys (usually under a minute), the demo-data banner disappears
and your real trip shows up.

You can also set two optional things in this same file:

- `TRIP_BUDGET` — a number, e.g. `6000`. Adds a budget progress bar to the
  Spending page. Leave as `null` to hide it.
- `TRIP_NAME` — the title shown at the top of every page.

---

## 6. Host it for free (GitHub Pages)

If you're reading this file on GitHub, you're most of the way there. GitHub
Pages turns this repository into a live website for free.

1. On GitHub, go to this repository's **Settings** tab.
2. In the left sidebar, click **Pages**.
3. Under "Build and deployment" → "Source," choose **Deploy from a branch**.
4. Under "Branch," choose `main` (or whichever branch has these files) and
   folder `/ (root)`. Click **Save**.
5. Wait a minute or two, then refresh the page — GitHub shows the live URL
   at the top, something like `https://loganbrose.github.io/Road_Trip/`.

That URL is what you share with family. Every time you push a change to
this repository (like editing `config.js`), GitHub Pages automatically
redeploys it — you don't need to do anything else. Editing the Google
Sheet itself doesn't require a redeploy at all, since the site fetches the
sheet live.

---

## 7. Updating the trip from your phone

Day to day, you'll only ever touch the **Google Sheet**, using the Google
Sheets app (iOS/Android) or sheets.google.com in your phone's browser —
never the code.

- **Arrived somewhere new?** Add a row to the Stops tab. Set that row's
  `status` to `Current`, and change your *previous* stop's `status` to
  `Visited`.
- **Spent money?** Add a row to the Spending tab.
- **Took a great photo?** See [section 8](#8-adding-photos).

**One quirk to know:** Google's "publish to web" data is cached and can
take up to about 5 minutes to reflect an edit. If you update the sheet and
the site still shows old data, wait a few minutes and reload (a hard reload
— pull down to refresh, or reload the browser tab). This is normal and not
a bug.

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
4. Paste that link into the `photo_url` column in the Photos tab, along
   with the `stop` name, `date`, and an optional `caption`.

The site automatically converts a normal Drive share link into a viewable
image behind the scenes (see `driveImageUrl` in `js/data.js` if you're
curious how). No need to reformat the link yourself.

**If Drive images ever stop loading** (Google occasionally changes how it
serves shared files, or a link's sharing gets reset to private), the
fallback is any other image host that gives you a direct link ending in
something like `.jpg` — Imgur is a common free option. Paste that link into
`photo_url` instead; the site displays it as-is if it doesn't look like a
Drive link.

---

## 9. Customizing

A few things you might want to tweak, and where to find them:

- **Status colors / pin colors** — `App.STATUS_COLORS` near the top of
  `js/data.js`.
- **Map's starting position/zoom** — `MAP_START_VIEW` in `js/config.js`.
  (The map auto-zooms to fit your pins anyway, so this is just what shows
  for a split second before that happens.)
- **Overall look** (colors, fonts, spacing) — CSS variables at the top of
  `css/style.css`, under `:root`.
- **Site title** — `TRIP_NAME` in `js/config.js`.
- **Adding a new status** (e.g. "Cancelled") — add it to `STATUS_COLORS` in
  `js/data.js` and to `App.normalizeStatus`'s matching rules.

---

## 10. Troubleshooting

**The map/itinerary/spending/gallery is blank, or shows the demo banner
even after I connected my sheet.**
Double-check each URL in `config.js` — it must end in `output=csv`, and
each one must point at the correct tab (re-publishing sometimes resets the
tab dropdown to "Entire Document" by accident, which won't work). Also
confirm the tab was published as CSV, not just "shared" with a person —
publishing and sharing are different things in Google Sheets.

**The site shows old data after I edited the sheet.**
Wait ~5 minutes (Google's publish cache) and do a hard refresh. If it's
been much longer than that, re-check File → Share → Publish to web — it's
possible publishing got turned off.

**A photo won't load (broken image icon).**
Usually the Drive file's sharing isn't set to "Anyone with the link," or it
got reset. Reopen it in Drive and check. See [section 8](#8-adding-photos)
for the Imgur fallback.

**A pin is in the wrong place, or missing.**
Check that `latitude`/`longitude` in the Stops tab are plain decimal
numbers (not something like `37°17'53"N`), and that `latitude` isn't
accidentally swapped with `longitude`.

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
- **CDN / vendored library** — code someone else wrote (like the map
  library) that this site uses. "Vendored" means a copy of it lives in this
  repo's `vendor/` folder instead of being fetched from the internet each
  time.
- **GitHub Pages** — GitHub's free static website hosting, used here to
  turn this repository into a live URL.
- **Publish to web** — a Google Sheets feature that creates a public,
  read-only, auto-updating link to a sheet (or one tab of it).
