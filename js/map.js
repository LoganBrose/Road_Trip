/*
  map.js — powers the home page: the Leaflet map, the colored pins,
  the line connecting visited stops, and the stats strip up top.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Map";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;
  App.$("#trip-name-heading").textContent = CONFIG.TRIP_NAME;

  const map = L.map("map").setView([CONFIG.MAP_START_VIEW.lat, CONFIG.MAP_START_VIEW.lng], CONFIG.MAP_START_VIEW.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  App.loadStops().then(({ rows: stops, usedDemo }) => {
    App.initPageChrome([usedDemo]);

    const valid = stops.filter((s) => s.latitude != null && s.longitude != null);

    // Pins, colored by status
    const markers = [];
    valid.forEach((stop) => {
      const color = App.statusColor(stop.status);
      const marker = L.circleMarker([stop.latitude, stop.longitude], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map);

      marker.bindPopup(`
        <h3>${escapeHtml(stop.name)}${stop.state ? ", " + escapeHtml(stop.state) : ""}</h3>
        <div><span class="status-badge" style="background:${color}">${App.statusLabel(stop.status)}</span></div>
        ${stop.arrival_date ? `<div class="popup-row">📅 ${App.formatDate(stop.arrival_date)}${stop.nights != null ? " · " + stop.nights + " night" + (stop.nights === 1 ? "" : "s") : ""}</div>` : ""}
        ${stop.mileage != null ? `<div class="popup-row">🚗 ${stop.mileage.toLocaleString()} mi${stop.drive_hours != null ? " · " + stop.drive_hours + " hr" : ""}</div>` : ""}
        ${stop.accommodation ? `<div class="popup-row">🏠 ${escapeHtml(stop.accommodation)}</div>` : ""}
        ${stop.activity ? `<div class="popup-row">🎯 ${escapeHtml(stop.activity)}</div>` : ""}
        ${stop.weather ? `<div class="popup-row">☀️ ${escapeHtml(stop.weather)}</div>` : ""}
        ${stop.rating ? `<div class="popup-row stars">${App.ratingStars(stop.rating)}</div>` : ""}
        ${stop.notes ? `<div class="popup-row">${escapeHtml(stop.notes)}</div>` : ""}
      `);
      markers.push(marker);
    });

    if (markers.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.15));
    }

    // Line connecting visited stops, in date order
    const path = valid
      .filter((s) => s.status === "visited")
      .sort((a, b) => App.parseDate(a.arrival_date) - App.parseDate(b.arrival_date))
      .map((s) => [s.latitude, s.longitude]);

    if (path.length > 1) {
      L.polyline(path, { color: "#b5502e", weight: 3, opacity: 0.7, dashArray: "6 6" }).addTo(map);
    }

    renderStats(valid);
  });

  function renderStats(stops) {
    const visited = stops.filter((s) => s.status === "visited");
    const planned = stops.filter((s) => s.status === "planned");

    const nights = visited.reduce((sum, s) => sum + (s.nights || 0), 0);
    const miles = visited.reduce((sum, s) => sum + (s.mileage || 0), 0);
    const states = new Set(visited.map((s) => s.state).filter(Boolean));

    App.$("#stat-visited").textContent = visited.length;
    App.$("#stat-remaining").textContent = planned.length;
    App.$("#stat-nights").textContent = nights;
    App.$("#stat-miles").textContent = miles.toLocaleString();
    App.$("#stat-states").textContent = states.size;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
