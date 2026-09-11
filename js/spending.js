/*
  spending.js — totals, a category breakdown chart, and the trip budget
  (from the Budget tab).
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Spending";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;

  const CATEGORY_COLORS = ["#b5502e", "#1565c0", "#2e7d32", "#f9a825", "#6a4c93", "#00838f", "#9e9e9e", "#c2185b", "#5d4037"];

  Promise.all([App.loadSpending(), App.loadBudget()]).then(([spendingRes, budgetRes]) => {
    App.initPageChrome([spendingRes.usedDemo, budgetRes.usedDemo]);
    renderSpending(spendingRes.rows);
    renderBudget(budgetRes.rows);

    const el = App.$("#debug-line");
    if (el) {
      el.textContent = `Data check: ${spendingRes.rows.length} spending row${spendingRes.rows.length === 1 ? "" : "s"} loaded, ${budgetRes.rows.length} budget categor${budgetRes.rows.length === 1 ? "y" : "ies"} loaded.` +
        (spendingRes.usedDemo || budgetRes.usedDemo ? " (using demo data — see banner above)" : "");
    }
  });

  function renderSpending(rows) {
    App.$("#empty-state").hidden = rows.length > 0;
    if (!rows.length) return;

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    App.$("#spend-total").textContent = App.formatMoney(total);

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
          backgroundColor: categories.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
          borderColor: "#1a1e29",
          borderWidth: 2
        }]
      },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, color: "#e7e9ee" } }
        }
      }
    });
  }

  function renderBudget(rows) {
    App.$("#budget-empty").hidden = rows.length > 0;
    if (!rows.length) return;

    const totalPlanned = rows.reduce((sum, r) => sum + r.planned, 0);
    const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);

    if (totalPlanned > 0) {
      App.$("#budget-wrap").hidden = false;
      const pct = Math.min(100, (totalActual / totalPlanned) * 100);
      App.$("#budget-bar-fill").style.width = pct.toFixed(1) + "%";
      App.$("#budget-text").textContent =
        `${App.formatMoney(totalActual)} of ${App.formatMoney(totalPlanned)} planned (${pct.toFixed(0)}%)`;
    }

    const tbody = App.$("#budget-table tbody");
    rows.forEach((r) => {
      const remaining = r.remaining != null ? r.remaining : (r.planned - r.actual);
      const tr = App.el("tr", {}, [
        App.el("td", {}, [r.category]),
        App.el("td", {}, [App.formatMoney(r.planned)]),
        App.el("td", {}, [App.formatMoney(r.actual)]),
        App.el("td", { style: remaining < 0 ? "color:#e0524d;font-weight:600;" : "" }, [App.formatMoney(remaining)])
      ]);
      tbody.appendChild(tr);
    });

    const totalRemaining = rows.reduce((sum, r) => sum + (r.remaining != null ? r.remaining : (r.planned - r.actual)), 0);
    const tfoot = App.$("#budget-table tfoot");
    tfoot.appendChild(App.el("tr", { style: "font-weight:700;border-top:2px solid var(--border);" }, [
      App.el("td", {}, ["Total"]),
      App.el("td", {}, [App.formatMoney(totalPlanned)]),
      App.el("td", {}, [App.formatMoney(totalActual)]),
      App.el("td", {}, [App.formatMoney(totalRemaining)])
    ]));
  }
})();
