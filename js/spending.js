/*
  spending.js — totals, a category breakdown chart, an optional budget bar,
  and a full transaction table, all built from the Spending tab.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Spending";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;

  const CATEGORY_COLORS = ["#b5502e", "#1565c0", "#2e7d32", "#f9a825", "#6a4c93", "#00838f", "#9e9e9e"];

  App.loadSpending().then(({ rows, usedDemo }) => {
    App.initPageChrome([usedDemo]);

    App.$("#empty-state").hidden = rows.length > 0;
    if (!rows.length) return;

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    App.$("#spend-total").textContent = App.formatMoney(total);

    if (CONFIG.TRIP_BUDGET) {
      App.$("#budget-wrap").hidden = false;
      const pct = Math.min(100, (total / CONFIG.TRIP_BUDGET) * 100);
      App.$("#budget-bar-fill").style.width = pct.toFixed(1) + "%";
      App.$("#budget-text").textContent =
        `${App.formatMoney(total)} of ${App.formatMoney(CONFIG.TRIP_BUDGET)} budget (${pct.toFixed(0)}%)`;
    }

    // Category breakdown
    const byCategory = {};
    rows.forEach((r) => { byCategory[r.category] = (byCategory[r.category] || 0) + r.amount; });
    const categories = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);

    const tbody = App.$("#category-table tbody");
    categories.forEach((cat) => {
      const tr = App.el("tr", {}, [
        App.el("td", {}, [cat]),
        App.el("td", {}, [App.formatMoney(byCategory[cat])]),
        App.el("td", {}, [((byCategory[cat] / total) * 100).toFixed(1) + "%"])
      ]);
      tbody.appendChild(tr);
    });

    new Chart(App.$("#category-chart"), {
      type: "doughnut",
      data: {
        labels: categories,
        datasets: [{
          data: categories.map((c) => byCategory[c]),
          backgroundColor: categories.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length])
        }]
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }
      }
    });

    // Transaction table, most recent first
    const txBody = App.$("#tx-table tbody");
    [...rows].reverse().forEach((r) => {
      const tr = App.el("tr", {}, [
        App.el("td", {}, [App.formatDate(r.date)]),
        App.el("td", {}, [r.stop || "—"]),
        App.el("td", {}, [r.category]),
        App.el("td", {}, [App.formatMoney(r.amount)]),
        App.el("td", {}, [r.notes || ""])
      ]);
      txBody.appendChild(tr);
    });
  });
})();
