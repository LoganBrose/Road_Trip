/*
  map.js — powers the home page: the Leaflet map, the colored pins, the route
  lines, the "right now" strip and the stats up top.

  It loads all three data tabs rather than just Stops, because the map is the
  page people actually open: each pin shows a photo from that stop and what was
  spent there, and links through to the rest of the site. Photos and Spending
  are loaded defensively — if either tab fails, the map still draws.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Map";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;
  App.$("#trip-name-heading").textContent = CONFIG.TRIP_NAME;

  const DAY_MS = 24 * 60 * 60 * 1000;

  const map = L.map("map").setView([CONFIG.MAP_START_VIEW.lat, CONFIG.MAP_START_VIEW.lng], CONFIG.MAP_START_VIEW.zoom);

  // CARTO's dark basemap rather than standard OpenStreetMap: the site's UI is
  // dark, and the four status colors read far better against it than against
  // OSM's beige. Free and key-less, same as OSM's own tiles.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  // A failed Photos or Spending tab costs the popups some detail; it must never
  // cost the page its map.
  const optional = (promise) => promise.catch(() => ({ rows: [], usedDemo: false }));

  Promise.all([
    App.loadStops(),
    optional(App.loadPhotos()),
    optional(App.loadSpending())
  ]).then(([stopsRes, photosRes, spendingRes]) => {
    // Only the Stops flag drives the demo banner here — a demo Photos tab
    // shouldn't put a banner on a map that's showing real stops.
    App.initPageChrome([stopsRes.usedDemo]);

    const stops = stopsRes.rows;
    const valid = stops.filter((s) => s.latitude != null && s.longitude != null);

    const photosBySlug = groupBySlug(photosRes.rows, (p) => p.stop);
    const spendBySlug = totalBySlug(spendingRes.rows);

    // Pins, colored by status
    const entries = valid.map((stop) => ({ stop, marker: addMarker(stop) }));
    const markers = entries.map((e) => e.marker);

    if (markers.length) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
    }

    renderDiagnostic(stops, valid, stopsRes.headers);

    const byDate = (a, b) => App.parseDate(a.arrival_date) - App.parseDate(b.arrival_date);
    const latLngs = (list) => list.map((s) => [s.latitude, s.longitude]);

    // The road already covered: visited stops, through today's stop, in date order.
    const drivenStops = valid.filter((s) => s.status === "visited" || s.status === "current").sort(byDate);
    const drivenPath = latLngs(drivenStops);

    let drivenLine = null;
    if (drivenPath.length > 1) {
      // interactive:false keeps the line from swallowing clicks aimed at a pin
      // sitting underneath it.
      drivenLine = L.polyline(drivenPath, { color: "#5dade2", weight: 3, opacity: 0.9, interactive: false }).addTo(map);
      // Straight lines are on screen already; real road geometry replaces them
      // if and when the routing service answers. See js/route.js.
      App.fetchRoadRoute(drivenPath).then((routed) => drivenLine.setLatLngs(routed));
    }

    // The road ahead: today's stop onward through what's still planned, so the
    // shape of the rest of the trip shows up instead of a scatter of loose pins.
    const aheadStops = valid.filter((s) => s.status === "current" || s.status === "planned").sort(byDate);
    const aheadPath = latLngs(aheadStops);

    if (aheadPath.length > 1) {
      const aheadLine = L.polyline(aheadPath, {
        color: App.STATUS_COLORS.planned,
        weight: 2,
        opacity: 0.5,
        dashArray: "2 8",
        interactive: false
      }).addTo(map);
      App.fetchRoadRoute(aheadPath).then((routed) => aheadLine.setLatLngs(routed));
    }

    if (drivenLine) {
      App.initPlayback({ map, line: drivenLine, entries, driven: drivenStops });
    }

    renderNowStrip(stops);
    renderStats(valid);
    renderRanking(stops);
    wireStopHash(entries);

    function addMarker(stop) {
      const color = App.statusColor(stop.status);
      const marker = L.circleMarker([stop.latitude, stop.longitude], {
        radius: stop.status === "current" ? 11 : 8,
        color: "#e7e9ee",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindPopup(popupHtml(stop), { minWidth: 220 });
      return marker;
    }

    function popupHtml(stop) {
      const color = App.statusColor(stop.status);
      const textColor = App.statusTextColor(stop.status);
      const slug = App.stopSlug(stop.name);
      const photos = photosBySlug[slug] || [];
      const spent = spendBySlug[slug] || 0;

      // A photo URL that no longer resolves (a Drive link whose sharing was
      // revoked, say) should leave no trace rather than a broken-image box.
      const thumb = photos.length
        ? `<img class="popup-thumb" src="${escapeHtml(App.driveImageUrl(photos[0].photo_url, 400))}" alt="" loading="lazy" onerror="this.remove()">`
        : "";

      const links = [
        photos.length
          ? `<a href="gallery.html#stop=${slug}">📷 ${photos.length} photo${photos.length === 1 ? "" : "s"} →</a>`
          : "",
        spent > 0
          ? `<a href="spending.html#stop=${slug}">💵 ${App.formatMoney(spent)} spent here →</a>`
          : ""
      ].filter(Boolean).join("");

      return `
        ${thumb}
        <h3>${escapeHtml(App.displayName(stop))}</h3>
        <div><span class="status-badge" style="background:${color};color:${textColor}">${App.statusLabel(stop.status)}</span></div>
        ${stop.arrival_date ? `<div class="popup-row">📅 ${App.formatDate(stop.arrival_date)}${stop.nights != null ? " · " + stop.nights + " night" + (stop.nights === 1 ? "" : "s") : ""}</div>` : ""}
        ${stop.mileage != null ? `<div class="popup-row">🚗 ${stop.mileage.toLocaleString()} mi${stop.drive_hours != null ? " · " + stop.drive_hours + " hr" : ""}</div>` : ""}
        ${stop.accommodation ? `<div class="popup-row">🏠 ${escapeHtml(stop.accommodation)}</div>` : ""}
        ${stop.activity ? `<div class="popup-row">🎯 ${escapeHtml(stop.activity)}</div>` : ""}
        ${stop.weather ? `<div class="popup-row">☀️ ${escapeHtml(stop.weather)}</div>` : ""}
        ${stop.rating != null ? `<div class="popup-row stars">${App.formatRating(stop.rating)}</div>` : ""}
        ${stop.notes ? `<div class="popup-row">${escapeHtml(stop.notes)}</div>` : ""}
        ${links ? `<div class="popup-links">${links}</div>` : ""}
      `;
    }
  });

  // Photos and Spending name their stop as free text, so both are bucketed by
  // slug — that's what lets "St. Louis" there match "St Louis" in Stops.
  function groupBySlug(rows, keyFn) {
    const out = {};
    rows.forEach((r) => {
      const slug = App.stopSlug(keyFn(r));
      if (!slug) return;
      (out[slug] = out[slug] || []).push(r);
    });
    return out;
  }

  function totalBySlug(rows) {
    const out = {};
    rows.forEach((r) => {
      const slug = App.stopSlug(r.stop);
      if (!slug) return;
      out[slug] = (out[slug] || 0) + r.amount;
    });
    return out;
  }

  /*
    Opening index.html#stop=st-louis (from the itinerary, the gallery or a
    shared link) zooms to that pin and opens its popup.
  */
  function wireStopHash(entries) {
    const focus = () => {
      const m = location.hash.match(/^#stop=(.+)$/);
      if (!m) return;
      const slug = decodeURIComponent(m[1]);
      const entry = entries.find((e) => App.stopSlug(e.stop.name) === slug);
      if (!entry) return;
      map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 8), { animate: !App.reducedMotion() });
      entry.marker.openPopup();
    };
    focus();
    window.addEventListener("hashchange", focus);
  }

  /*
    The one-line answer to "where are they right now?" — the question the site
    exists to answer, and the one thing a yellow pin alone doesn't say.
  */
  function renderNowStrip(stops) {
    const el = App.$("#now-strip");
    if (!el || !stops.length) return;

    const today = startOfToday();
    const current = stops.find((s) => s.status === "current");
    const visited = stops.filter((s) => s.status === "visited");
    const planned = stops.filter((s) => s.status === "planned");
    const counted = stops.filter((s) => s.status !== "skipped");
    const soFar = visited.concat(current ? [current] : []);

    const miles = soFar.reduce((sum, s) => sum + (s.mileage || 0), 0);
    const nights = soFar.reduce((sum, s) => sum + (s.nights || 0), 0);
    const dayNumber = daysBetween(App.parseDate(stops[0].arrival_date), today) + 1;
    const next = planned[0];

    // "next stop X in 3 days" — but only when that's actually true. A planned
    // stop whose date has already passed gets named without a timing claim.
    const nextPhrase = () => {
      const when = next ? whenPhrase(next, today) : null;
      return `next stop ${App.displayName(next)}${when ? " " + when : ""}`;
    };

    const parts = [];
    if (current) {
      if (dayNumber > 0) parts.push(`Day ${dayNumber}`);
      parts.push(`In ${App.displayName(current)}`);
      parts.push(`${miles.toLocaleString()} mi driven`);
      if (next) parts.push(nextPhrase());
    } else if (visited.length && next) {
      if (dayNumber > 0) parts.push(`Day ${dayNumber}`);
      parts.push(`${visited.length} stop${visited.length === 1 ? "" : "s"} behind us`);
      parts.push(`${miles.toLocaleString()} mi driven`);
      parts.push(nextPhrase());
    } else if (!visited.length && next) {
      const when = whenPhrase(next, today);
      parts.push(when ? `Departs ${when}` : `Departs ${App.formatDate(next.arrival_date)}`);
      parts.push(`${App.displayName(stops[0])} → ${App.displayName(stops[stops.length - 1])}`);
      parts.push(`${counted.length} stops planned`);
    } else {
      parts.push("Trip complete");
      parts.push(`${visited.length} stop${visited.length === 1 ? "" : "s"}`);
      parts.push(`${miles.toLocaleString()} miles`);
      parts.push(`${nights} night${nights === 1 ? "" : "s"}`);
    }

    el.hidden = false;
    App.$("#now-text").textContent = parts.join(" · ");

    const done = soFar.length;
    const pct = counted.length ? Math.round((done / counted.length) * 100) : 0;
    App.$("#now-progress-fill").style.width = pct + "%";
    App.$("#now-progress-label").textContent = `${done} of ${counted.length} stops · ${pct}%`;
  }

  // Returns null rather than a phrase when there's nothing truthful to say —
  // an undated stop, or one whose date is already behind us.
  function whenPhrase(stop, today) {
    const days = daysBetween(today, App.parseDate(stop.arrival_date));
    if (isNaN(days) || days < 0) return null;
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }

  function startOfToday() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysBetween(from, to) {
    if (!from || !to || from.getTime() === 0 || to.getTime() === 0) return NaN;
    return Math.round((to - from) / DAY_MS);
  }

  function renderStats(stops) {
    const visited = stops.filter((s) => s.status === "visited");
    const current = stops.filter((s) => s.status === "current");
    const planned = stops.filter((s) => s.status === "planned");
    const soFar = visited.concat(current); // ground already covered, including today's stop

    const nights = soFar.reduce((sum, s) => sum + (s.nights || 0), 0);
    const miles = soFar.reduce((sum, s) => sum + (s.mileage || 0), 0);
    const states = new Set(soFar.map((s) => s.state).filter(Boolean));

    countUp(App.$("#stat-visited"), visited.length);
    countUp(App.$("#stat-remaining"), planned.length);
    countUp(App.$("#stat-nights"), nights);
    countUp(App.$("#stat-miles"), miles);
    countUp(App.$("#stat-states"), states.size);
  }

  // Counts a stat up from zero on load. Purely decorative, so anyone who's
  // asked for reduced motion just gets the final number.
  function countUp(el, value) {
    if (!el) return;
    if (App.reducedMotion() || value === 0) {
      el.textContent = value.toLocaleString();
      return;
    }
    const duration = 700;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(value * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function renderRanking(stops) {
    const list = App.$("#ranking-list");
    const empty = App.$("#ranking-empty");
    if (!list) return;

    const ranked = stops
      .filter((s) => s.status === "visited" && s.rating != null)
      .sort((a, b) => b.rating - a.rating);

    empty.hidden = ranked.length > 0;
    list.innerHTML = "";
    ranked.forEach((stop, i) => {
      const li = App.el("li", {}, [
        App.el("div", { class: "ranking-rank" }, [String(i + 1)]),
        App.el("div", { class: "ranking-info" }, [
          App.el("a", { class: "name", href: "index.html#stop=" + App.stopSlug(stop.name) }, [App.displayName(stop)]),
          App.el("div", { class: "score" }, [`${stop.rating}/10`])
        ])
      ]);
      list.appendChild(li);
    });
  }

  // Troubleshooting aid for a sheet that isn't loading — see README section 10.
  // Hidden unless ?debug=1 is in the URL, so visitors never see it.
  function renderDiagnostic(stops, valid, headers) {
    const el = App.$("#debug-line");
    if (!el || !App.isDebug()) return;
    let text = `Data check: ${stops.length} stop${stops.length === 1 ? "" : "s"} loaded from your sheet, ${valid.length} with usable coordinates.`;
    if (stops.length > 0 && valid.length === 0) {
      const first = stops[0];
      text += ` First stop "${first.name}" — raw Latitude: "${first._rawLatitude || "(blank)"}", raw Longitude: "${first._rawLongitude || "(blank)"}", raw Nights: "${first._rawNights || "(blank)"}", raw Miles: "${first._rawMileage || "(blank)"}".`;
      text += ` Headers read from row 3: [${(headers || []).map((h) => `"${h}"`).join(", ")}]`;
    }
    el.textContent = text;
    el.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
