/*
  gallery.js — groups photos by stop (in the order stops happened) and
  shows a simple click-to-enlarge lightbox. No dependencies needed.
*/
(function () {
  document.title = CONFIG.TRIP_NAME + " — Photos";
  App.$("#trip-name").textContent = CONFIG.TRIP_NAME;

  Promise.all([App.loadPhotos(), App.loadStops()]).then(([photosRes, stopsRes]) => {
    App.initPageChrome([photosRes.usedDemo, stopsRes.usedDemo]);

    const photos = photosRes.rows;
    App.$("#empty-state").hidden = photos.length > 0;
    if (!photos.length) return;

    // Order groups by each stop's arrival date (falls back to first-photo-date for stops not in the Stops tab)
    const stopOrder = {};
    stopsRes.rows.forEach((s, i) => { stopOrder[s.name] = i; });

    const groups = {};
    photos.forEach((p) => {
      const key = p.stop || "Unsorted";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const groupNames = Object.keys(groups).sort((a, b) => {
      const ao = stopOrder[a] != null ? stopOrder[a] : 9999;
      const bo = stopOrder[b] != null ? stopOrder[b] : 9999;
      if (ao !== bo) return ao - bo;
      return App.parseDate(groups[a][0].date) - App.parseDate(groups[b][0].date);
    });

    const container = App.$("#gallery-container");
    groupNames.forEach((name) => {
      const grid = App.el("div", { class: "gallery-grid" },
        groups[name].map((p) => {
          const thumb = App.driveImageUrl(p.photo_url, 500);
          const item = App.el("div", { class: "gallery-item" }, [
            App.el("img", { src: thumb, alt: p.caption || name, loading: "lazy" })
          ]);
          item.addEventListener("click", () => openLightbox(p));
          return item;
        })
      );
      container.appendChild(App.el("div", { class: "gallery-group" }, [
        App.el("h2", {}, [name]),
        grid
      ]));
    });
  });

  function openLightbox(photo) {
    const box = App.el("div", { class: "lightbox" }, [
      App.el("button", { class: "close-btn", "aria-label": "Close" }, ["×"]),
      App.el("img", { src: App.driveImageUrl(photo.photo_url, 1400), alt: photo.caption || photo.stop }),
      App.el("div", { class: "caption" }, [
        [photo.stop, App.formatDate(photo.date)].filter(Boolean).join(" · ") + (photo.caption ? " — " + photo.caption : "")
      ])
    ]);
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("close-btn")) box.remove();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { box.remove(); document.removeEventListener("keydown", onKey); }
    });
    document.body.appendChild(box);
  }
})();
