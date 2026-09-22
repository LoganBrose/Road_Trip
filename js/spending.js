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

    // Troubleshooting aid for a sheet that isn't loading — see README section 10.
    // Hidden unless ?debug=1 is in the URL, so visitors never see it.
    const el = App.$("#debug-line");
    if (el && App.isDebug()) {
      el.textContent = `Data check: ${spendingRes.rows.length} spending row${spendingRes.rows.length === 1 ? "" : "s"} loaded, ${budgetRes.rows.length} budget categor${budgetRes.rows.length === 1 ? "y" : "ies"} loaded.` +
        (spendingRes.usedDemo || budgetRes.usedDemo ? " (using demo data — see banner above)" : "");
      el.hidden = false;
    }

    highlightStopFromHash();
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const AXIS_COLOR = "#9aa1b0";
  const GRID_COLOR = "rgba(154, 161, 176, 0.15)";

  // Sums `amount` into buckets keyed by one field, biggest first.
  // Used for both the category and the by-stop breakdowns.
  function totalsBy(rows, keyFn) {
    const totals = {};
    rows.forEach((r) => {
      const key = keyFn(r);
      totals[key] = (totals[key] || 0) + r.amount;
    });
    return Object.keys(totals)
      .sort((a, b) => totals[b] - totals[a])
      .map((key) => ({ key, amount: totals[key] }));
  }

  // withSlug tags each row with its stop slug, which is what lets a map popup
  // link straight to a stop's row (spending.html#stop=st-louis).
  function fillBreakdownTable(selector, entries, total, withSlug) {
    const tbody = App.$(selector);
    entries.forEach(({ key, amount }) => {
      const attrs = withSlug ? { "data-slug": App.stopSlug(key) } : {};
      tbody.appendChild(App.el("tr", attrs, [
        App.el("td", {}, [key]),
        App.el("td", {}, [App.formatMoney(amount)]),
        App.el("td", {}, [((amount / total) * 100).toFixed(1) + "%"])
      ]));
    });
  }

  function highlightStopFromHash() {
    const m = location.hash.match(/^#stop=(.+)$/);
    if (!m) return;
    const slug = decodeURIComponent(m[1]);
    const row = App.$(`#stop-table tbody tr[data-slug="${slug}"]`);
    if (!row) return;
    row.classList.add("is-target");
    row.scrollIntoView({ behavior: App.reducedMotion() ? "auto" : "smooth", block: "center" });
  }

  function renderSpending(rows) {
    App.$("#empty-state").hidden = rows.length > 0;
    if (!rows.length) return;

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    App.$("#spend-total").textContent = App.formatMoney(total);

    renderPerDay(rows, total);

    // Category breakdown
    const byCategory = totalsBy(rows, (r) => r.category);
    const categories = byCategory.map((e) => e.key);
    fillBreakdownTable("#category-table tbody", byCategory, total);

    // Stop breakdown — which places the money actually went to. The Spending
    // tab's "Stop / Location" column is blank often enough to need a bucket.
    fillBreakdownTable("#stop-table tbody", totalsBy(rows, (r) => r.stop || "Unassigned"), total, true);

    renderOverTime(rows);

    new Chart(App.$("#category-chart"), {
      type: "doughnut",
      data: {
        labels: categories,
        datasets: [{
          data: byCategory.map((e) => e.amount),
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

  /*
    Average daily burn across the span the spending actually covers (first
    logged day through the last, inclusive) — the number that says whether
    the trip's pace is sustainable.
  */
  function renderPerDay(rows, total) {
    const first = App.parseDate(rows[0].date);
    const last = App.parseDate(rows[rows.length - 1].date);
    // parseDate returns the epoch for anything it can't read; averaging
    // against that would produce a nonsense figure, so leave the dash.
    if (first.getTime() === 0 || last.getTime() === 0) return;

    const days = Math.max(1, Math.round((last - first) / DAY_MS) + 1);
    App.$("#spend-per-day").textContent = App.formatMoney(total / days);
  }

  /*
    Running total by day. Rows arrive date-sorted from App.loadSpending, so
    collapsing them into a Map keeps the days in order; the slope of the
    line is the part worth looking at.
  */
  function renderOverTime(rows) {
    const canvas = App.$("#over-time-chart");
    if (!canvas) return;

    const perDay = new Map();
    rows.forEach((r) => { perDay.set(r.date, (perDay.get(r.date) || 0) + r.amount); });

    let running = 0;
    const points = Array.from(perDay, ([date, amount]) => {
      running += amount;
      return { date, running };
    });

    new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map((p) => App.formatDate(p.date)),
        datasets: [{
          data: points.map((p) => p.running),
          borderColor: "#5dade2",
          backgroundColor: "rgba(93, 173, 226, 0.15)",
          borderWidth: 2,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHitRadius: 12
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => App.formatMoney(ctx.parsed.y) + " spent so far" }
          }
        },
        scales: {
          x: { ticks: { color: AXIS_COLOR, maxRotation: 0, autoSkipPadding: 20 }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { color: AXIS_COLOR, callback: (v) => "$" + Number(v).toLocaleString() },
            grid: { color: GRID_COLOR }
          }
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
