/*
  itinerary.js — renders every stop as a card, in date order, with a
  status filter (All / Visited / Current / Planned / Skipped).

  Each card's title links back to that pin on the map, and a stop with photos
  gets a count that links into the gallery — so the list is a way into the rest
  of the site rather than a dead end.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Itinerary";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;

  let allStops = [];
  let photoCounts = {};
  let activeFilter = "all";

  // A failed Photos tab just means no photo counts — the list still renders.
  const optional = (promise) => promise.catch(() => ({ rows: [], usedDemo: false }));

  Promise.all([App.loadStops(), optional(App.loadPhotos())]).then(([stopsRes, photosRes]) => {
    App.initPageChrome([stopsRes.usedDemo]);
    allStops = stopsRes.rows;

    photosRes.rows.forEach((p) => {
      const slug = App.stopSlug(p.stop);
      if (slug) photoCounts[slug] = (photoCounts[slug] || 0) + 1;
    });

    render();
  });

  App.$("#filter-row").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    App.$$(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    render();
  });

  function render() {
    const list = App.$("#stop-list");
    const filtered = activeFilter === "all" ? allStops : allStops.filter((s) => s.status === activeFilter);

    list.innerHTML = "";
    App.$("#empty-state").hidden = filtered.length > 0;

    filtered.forEach((stop) => {
      const d = App.parseDate(stop.arrival_date);
      const hasDate = stop.arrival_date && d.getTime() !== 0;
      const color = App.statusColor(stop.status);
      const slug = App.stopSlug(stop.name);
      const photos = photoCounts[slug] || 0;

      const card = App.el("div", { class: "card stop-card" }, [
        App.el("div", { class: "date-col" }, hasDate ? [
          App.el("div", { class: "day" }, [String(d.getDate())]),
          App.el("div", { class: "month" }, [d.toLocaleDateString(undefined, { month: "short" })])
        ] : [App.el("div", { class: "month" }, ["TBD"])]),
        App.el("div", {}, [
          App.el("h3", {}, [
            App.el("a", { class: "stop-link", href: "index.html#stop=" + slug, title: "See this stop on the map" }, [App.displayName(stop)]),
            App.el("span", { class: "status-badge", style: `background:${color};color:${App.statusTextColor(stop.status)}` }, [App.statusLabel(stop.status)]),
            photos ? App.el("a", { class: "photo-chip", href: "gallery.html#stop=" + slug }, ["📷 " + photos]) : null
          ].filter(Boolean)),
          App.el("div", { class: "stop-meta" }, [
            hasDate ? App.el("span", {}, ["📅 " + App.formatDate(stop.arrival_date)]) : null,
            stop.nights != null ? App.el("span", {}, ["🛌 " + stop.nights + " night" + (stop.nights === 1 ? "" : "s")]) : null,
            stop.mileage != null ? App.el("span", {}, ["🚗 " + stop.mileage.toLocaleString() + " mi" + (stop.drive_hours != null ? " (" + stop.drive_hours + " hr)" : "")]) : null,
            stop.accommodation ? App.el("span", {}, ["🏠 " + stop.accommodation]) : null,
            stop.activity ? App.el("span", {}, ["🎯 " + stop.activity]) : null,
            stop.weather ? App.el("span", {}, ["☀️ " + stop.weather]) : null
          ].filter(Boolean)),
          stop.rating != null ? App.el("div", { class: "stars" }, [App.formatRating(stop.rating)]) : null,
          stop.notes ? App.el("div", { class: "stop-notes" }, [stop.notes]) : null
        ].filter(Boolean))
      ]);
      list.appendChild(card);
    });
  }
})();
