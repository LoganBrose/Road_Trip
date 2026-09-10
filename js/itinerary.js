/*
  itinerary.js — renders every stop as a card, in date order, with a
  status filter (All / Visited / Current / Upcoming).
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Itinerary";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;

  let allStops = [];
  let activeFilter = "all";

  App.loadStops().then(({ rows: stops, usedDemo }) => {
    App.initPageChrome([usedDemo]);
    allStops = stops;
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

      const card = App.el("div", { class: "card stop-card" }, [
        App.el("div", { class: "date-col" }, hasDate ? [
          App.el("div", { class: "day" }, [String(d.getDate())]),
          App.el("div", { class: "month" }, [d.toLocaleDateString(undefined, { month: "short" })])
        ] : [App.el("div", { class: "month" }, ["TBD"])]),
        App.el("div", {}, [
          App.el("h3", {}, [
            stop.name + (stop.state ? ", " + stop.state : ""),
            App.el("span", { class: "status-badge", style: `background:${color};color:${App.statusTextColor(stop.status)}` }, [App.statusLabel(stop.status)])
          ]),
          App.el("div", { class: "stop-meta" }, [
            hasDate ? App.el("span", {}, ["📅 " + App.formatDate(stop.arrival_date)]) : null,
            stop.nights != null ? App.el("span", {}, ["🛌 " + stop.nights + " night" + (stop.nights === 1 ? "" : "s")]) : null,
            stop.mileage != null ? App.el("span", {}, ["🚗 " + stop.mileage.toLocaleString() + " mi" + (stop.drive_hours != null ? " (" + stop.drive_hours + " hr)" : "")]) : null,
            stop.accommodation ? App.el("span", {}, ["🏠 " + stop.accommodation]) : null,
            stop.activity ? App.el("span", {}, ["🎯 " + stop.activity]) : null,
            stop.weather ? App.el("span", {}, ["☀️ " + stop.weather]) : null
          ].filter(Boolean)),
          stop.rating ? App.el("div", { class: "stars" }, [App.ratingStars(stop.rating)]) : null,
          stop.notes ? App.el("div", { class: "stop-notes" }, [stop.notes]) : null
        ].filter(Boolean))
      ]);
      list.appendChild(card);
    });
  }
})();
