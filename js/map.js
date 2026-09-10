/*
  map.js — powers the home page: the Leaflet map, the colored pins,
  the line connecting visited (and current) stops, and the stats strip up top.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Map";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;
  App.$("#trip-name-heading").textContent = CONFIG.TRIP_NAME;

  const map = L.map("map").setView([CONFIG.MAP_START_VIEW.lat, CONFIG.MAP_START_VIEW.lng], CONFIG.MAP_START_VIEW.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  App.loadStops().then(({ rows: stops, usedDemo, headers }) => {
    App.initPageChrome([usedDemo]);

    const valid = stops.filter((s) => s.latitude != null && s.longitude != null);

    // Pins, colored by status
    const markers = [];
    valid.forEach((stop) => {
      const color = App.statusColor(stop.status);
      const textColor = App.statusTextColor(stop.status);
      const marker = L.circleMarker([stop.latitude, stop.longitude], {
        radius: stop.status === "current" ? 11 : 8,
        color: "#e7e9ee",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map);

      marker.bindPopup(`
        <h3>${escapeHtml(App.displayName(stop))}</h3>
        <div><span class="status-badge" style="background:${color};color:${textColor}">${App.statusLabel(stop.status)}</span></div>
        ${stop.arrival_date ? `<div class="popup-row">📅 ${App.formatDate(stop.arrival_date)}${stop.nights != null ? " · " + stop.nights + " night" + (stop.nights === 1 ? "" : "s") : ""}</div>` : ""}
        ${stop.mileage != null ? `<div class="popup-row">🚗 ${stop.mileage.toLocaleString()} mi${stop.drive_hours != null ? " · " + stop.drive_hours + " hr" : ""}</div>` : ""}
        ${stop.accommodation ? `<div class="popup-row">🏠 ${escapeHtml(stop.accommodation)}</div>` : ""}
        ${stop.activity ? `<div class="popup-row">🎯 ${escapeHtml(stop.activity)}</div>` : ""}
        ${stop.weather ? `<div class="popup-row">☀️ ${escapeHtml(stop.weather)}</div>` : ""}
        ${stop.rating != null ? `<div class="popup-row stars">${App.formatRating(stop.rating)}</div>` : ""}
        ${stop.notes ? `<div class="popup-row">${escapeHtml(stop.notes)}</div>` : ""}
      `);
      markers.push(marker);
    });

    if (markers.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.15));
    }

    renderDiagnostic(stops, valid, headers);

    // Line connecting visited stops, through today's (current) stop, in date order
    const path = valid
      .filter((s) => s.status === "visited" || s.status === "current")
      .sort((a, b) => App.parseDate(a.arrival_date) - App.parseDate(b.arrival_date))
      .map((s) => [s.latitude, s.longitude]);

    if (path.length > 1) {
      L.polyline(path, { color: "#5dade2", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(map);
    }

    renderStats(valid);
    renderRanking(stops);
  });

  function renderStats(stops) {
    const visited = stops.filter((s) => s.status === "visited");
    const current = stops.filter((s) => s.status === "current");
    const planned = stops.filter((s) => s.status === "planned");
    const soFar = visited.concat(current); // ground already covered, including today's stop

    const nights = soFar.reduce((sum, s) => sum + (s.nights || 0), 0);
    const miles = soFar.reduce((sum, s) => sum + (s.mileage || 0), 0);
    const states = new Set(soFar.map((s) => s.state).filter(Boolean));

    App.$("#stat-visited").textContent = visited.length;
    App.$("#stat-remaining").textContent = planned.length;
    App.$("#stat-nights").textContent = nights;
    App.$("#stat-miles").textContent = miles.toLocaleString();
    App.$("#stat-states").textContent = states.size;
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
          App.el("div", { class: "name" }, [App.displayName(stop)]),
          App.el("div", { class: "score" }, [`${stop.rating}/10`])
        ])
      ]);
      list.appendChild(li);
    });
  }

  function renderDiagnostic(stops, valid, headers) {
    const el = App.$("#debug-line");
    if (!el) return;
    let text = `Data check: ${stops.length} stop${stops.length === 1 ? "" : "s"} loaded from your sheet, ${valid.length} with usable coordinates.`;
    if (stops.length > 0 && valid.length === 0) {
      const first = stops[0];
      text += ` First stop "${first.name}" — raw Latitude: "${first._rawLatitude || "(blank)"}", raw Longitude: "${first._rawLongitude || "(blank)"}", raw Nights: "${first._rawNights || "(blank)"}", raw Miles: "${first._rawMileage || "(blank)"}".`;
      text += ` Headers read from row 3: [${(headers || []).map((h) => `"${h}"`).join(", ")}]`;
    }
    el.textContent = text;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
