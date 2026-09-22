/*
  gallery.js — groups photos by stop (in the order stops happened) and
  shows a click-to-enlarge lightbox you can page through with the arrow
  buttons, the keyboard, or a swipe. No dependencies needed.
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
      const groupPhotos = groups[name];
      const grid = App.el("div", { class: "gallery-grid" },
        groupPhotos.map((p, i) => {
          const thumb = App.driveImageUrl(p.photo_url, 500);
          const item = App.el("div", { class: "gallery-item" }, [
            App.el("img", { src: thumb, alt: p.caption || name, loading: "lazy" })
          ]);
          // Opens the whole group, starting here, so you can page through it.
          item.addEventListener("click", () => openLightbox(groupPhotos, i));
          return item;
        })
      );
      const slug = App.stopSlug(name);
      container.appendChild(App.el("div", { class: "gallery-group", id: "stop-" + slug }, [
        App.el("h2", {}, [
          name,
          App.el("a", { class: "group-map-link", href: "index.html#stop=" + slug }, ["View on map →"])
        ]),
        grid
      ]));
    });

    scrollToHashGroup();
  });

  /*
    Arriving from a map popup or an itinerary card (gallery.html#stop=st-louis)
    should land on that stop's photos rather than the top of the page. The hash
    isn't a plain element id, so the scroll is done here by hand.
  */
  function scrollToHashGroup() {
    const m = location.hash.match(/^#stop=(.+)$/);
    if (!m) return;
    const group = document.getElementById("stop-" + decodeURIComponent(m[1]));
    if (!group) return;
    group.scrollIntoView({ behavior: App.reducedMotion() ? "auto" : "smooth", block: "start" });
    group.classList.add("is-target");
  }

  /*
    Opens one stop's photos, starting at startIndex. Paging wraps around at
    both ends, so there's no dead-end arrow to notice.
  */
  function openLightbox(photos, startIndex) {
    let index = startIndex;

    const img = App.el("img", {});
    const caption = App.el("div", { class: "caption" }, []);
    const closeBtn = App.el("button", { class: "close-btn", "aria-label": "Close" }, ["×"]);
    const prevBtn = App.el("button", { class: "nav-btn prev", "aria-label": "Previous photo" }, ["‹"]);
    const nextBtn = App.el("button", { class: "nav-btn next", "aria-label": "Next photo" }, ["›"]);

    // A stop with a single photo has nothing to page to.
    if (photos.length < 2) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }

    const box = App.el("div", { class: "lightbox" }, [closeBtn, prevBtn, img, nextBtn, caption]);

    const at = (i) => photos[(i + photos.length) % photos.length];

    // Fetches a neighbouring photo into the browser cache so paging to it
    // shows the image instead of a blank gap while it downloads.
    function preload(i) {
      if (photos.length < 2) return;
      new Image().src = App.driveImageUrl(at(i).photo_url, 1400);
    }

    function showPhoto(i) {
      index = (i + photos.length) % photos.length;
      const photo = photos[index];
      img.src = App.driveImageUrl(photo.photo_url, 1400);
      img.alt = photo.caption || photo.stop;
      caption.textContent =
        [photo.stop, App.formatDate(photo.date)].filter(Boolean).join(" · ") +
        (photo.caption ? " — " + photo.caption : "");
      preload(index + 1);
      preload(index - 1);
    }

    const step = (delta) => showPhoto(index + delta);

    function close() {
      box.remove();
      document.removeEventListener("keydown", onKey);
    }

    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }

    prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });

    box.addEventListener("click", (e) => {
      if (e.target === box || e.target === closeBtn) close();
    });
    document.addEventListener("keydown", onKey);

    // Swipe left/right — this mostly gets looked at on a phone.
    let touchStartX = null;
    box.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (touchStartX == null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    showPhoto(startIndex);
    document.body.appendChild(box);
  }
})();
