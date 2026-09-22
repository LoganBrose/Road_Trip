/*
  playback.js — "Play the trip": drives a little car along the route you've
  already covered, lighting up each stop as it reaches it.

  It animates along whatever geometry the driven line is currently showing, so
  if route.js managed to fetch real road geometry the car follows the highways,
  and if it didn't the car follows the straight lines instead. Either way the
  stops themselves are found by matching each one to its nearest point on the
  line, which works for both shapes.

  Everything it touches is restored when it stops — the pins are dimmed and
  re-lit in place rather than replaced, so a run that's interrupted halfway
  (Escape, or pressing the button again) leaves the map exactly as it was.
*/
(function () {
  const PAUSE_AT_STOP_MS = 420;
  const MIN_RUN_MS = 7000;
  const MAX_RUN_MS = 26000;
  const MS_PER_STOP = 1500;

  const TRAIL_COLOR = "#f6c453";
  const DIM_FILL = 0.12;
  const DIM_STROKE = 0.25;

  /*
    Sets up the control and returns nothing — the button owns the whole
    lifecycle from here.

      map      the Leaflet map
      line     the driven polyline (its geometry is read fresh on each play)
      entries  [{ stop, marker }] for every stop with coordinates, any status
      driven   the driven stops in date order — what the car actually visits
  */
  App.initPlayback = function ({ map, line, entries, driven }) {
    if (!line || driven.length < 2) return; // nothing to play

    let running = false;
    let frame = null;
    let timers = [];
    let car = null;
    let trail = null;
    let restores = [];

    const hud = L.DomUtil.create("div", "trip-hud");
    hud.hidden = true;

    const HudControl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () { return hud; }
    });
    map.addControl(new HudControl());

    const button = L.DomUtil.create("button", "playback-btn");
    button.type = "button";
    setButton(false);

    const PlayControl = L.Control.extend({
      options: { position: "bottomleft" },
      onAdd: function () {
        const wrap = L.DomUtil.create("div", "playback-control");
        wrap.appendChild(button);
        // Without this, clicking the button also pans/zooms the map underneath.
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
        return wrap;
      }
    });
    map.addControl(new PlayControl());

    button.addEventListener("click", () => (running ? stop() : play()));

    function setButton(isRunning) {
      button.textContent = isRunning ? "⏹ Stop" : "▶ Play the trip";
      button.setAttribute("aria-label", isRunning ? "Stop the trip playback" : "Play the trip");
    }

    function onKey(e) {
      if (e.key === "Escape") stop();
    }

    // ---- geometry helpers -------------------------------------------------

    function lineCoords() {
      return line.getLatLngs().map((ll) => [ll.lat, ll.lng]);
    }

    // Cumulative metres along a list of points, so the car can move at a
    // steady speed instead of jumping between unevenly spaced vertices.
    function cumulative(points) {
      const out = [0];
      for (let i = 1; i < points.length; i++) {
        out.push(out[i - 1] + map.distance(points[i - 1], points[i]));
      }
      return out;
    }

    function nearestIndex(points, target) {
      let best = 0;
      let bestDist = Infinity;
      points.forEach((p, i) => {
        const d = map.distance(p, target);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    function pointAt(points, cum, metres) {
      if (metres <= 0) return points[0];
      const last = cum[cum.length - 1];
      if (metres >= last) return points[points.length - 1];
      let i = 1;
      while (i < cum.length && cum[i] < metres) i++;
      const span = cum[i] - cum[i - 1];
      const t = span === 0 ? 0 : (metres - cum[i - 1]) / span;
      const a = points[i - 1];
      const b = points[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    // ---- pin dimming ------------------------------------------------------

    function dimPins() {
      restores = entries.map(({ marker }) => {
        const before = {
          marker,
          fillOpacity: marker.options.fillOpacity,
          opacity: marker.options.opacity,
          radius: marker.options.radius
        };
        marker.setStyle({ fillOpacity: DIM_FILL, opacity: DIM_STROKE });
        return before;
      });
    }

    function restorePins() {
      restores.forEach((r) => {
        r.marker.setStyle({ fillOpacity: r.fillOpacity, opacity: r.opacity });
        r.marker.setRadius(r.radius);
      });
      restores = [];
    }

    function litUp(stop) {
      const entry = entries.find((e) => e.stop === stop);
      if (!entry) return;
      const saved = restores.find((r) => r.marker === entry.marker);
      entry.marker.setStyle({
        fillOpacity: saved ? saved.fillOpacity : 0.95,
        opacity: saved ? saved.opacity : 1
      });
      // A brief pop, so it's obvious which pin was just reached.
      const base = saved ? saved.radius : entry.marker.options.radius;
      entry.marker.setRadius(base + 5);
      timers.push(setTimeout(() => entry.marker.setRadius(base), 260));
    }

    // ---- the HUD ----------------------------------------------------------

    function showHud(stop, milesSoFar) {
      hud.hidden = false;
      hud.innerHTML = "";
      hud.appendChild(App.el("div", { class: "hud-name" }, [App.displayName(stop)]));
      const date = App.formatDate(stop.arrival_date);
      if (date) hud.appendChild(App.el("div", { class: "hud-sub" }, [date]));
      hud.appendChild(App.el("div", { class: "hud-sub" }, [milesSoFar.toLocaleString() + " mi driven"]));
    }

    // ---- play / stop ------------------------------------------------------

    function play() {
      const points = lineCoords();
      if (points.length < 2) return;

      running = true;
      setButton(true);
      document.addEventListener("keydown", onKey);

      const cum = cumulative(points);

      // Where each driven stop sits along the line. Clamped to be increasing
      // so a route that doubles back on itself can't send the car backwards.
      let previous = 0;
      const stopIdx = driven.map((s) => {
        const idx = Math.max(previous, nearestIndex(points, [s.latitude, s.longitude]));
        previous = idx;
        return idx;
      });
      stopIdx[stopIdx.length - 1] = points.length - 1;

      dimPins();

      trail = L.polyline([points[stopIdx[0]]], {
        color: TRAIL_COLOR, weight: 5, opacity: 0.95, interactive: false
      }).addTo(map);

      car = L.marker(points[stopIdx[0]], {
        icon: L.divIcon({ className: "trip-car", html: "🚗", iconSize: [28, 28], iconAnchor: [14, 14] }),
        interactive: false,
        zIndexOffset: 1000
      }).addTo(map);

      map.fitBounds(L.latLngBounds(points).pad(0.12));

      let milesSoFar = driven[0].mileage || 0;
      litUp(driven[0]);
      showHud(driven[0], milesSoFar);

      const totalMs = Math.min(MAX_RUN_MS, Math.max(MIN_RUN_MS, driven.length * MS_PER_STOP));

      if (App.reducedMotion()) {
        stepThroughStops(points, stopIdx, milesSoFar);
        return;
      }

      runLeg(0);

      function runLeg(legIndex) {
        if (!running) return;
        if (legIndex >= driven.length - 1) return finish();

        const from = cum[stopIdx[legIndex]];
        const to = cum[stopIdx[legIndex + 1]];
        const legMetres = to - from;
        const totalMetres = cum[cum.length - 1] || 1;
        // Each leg gets a slice of the run proportional to how far it is.
        const legMs = Math.max(220, (legMetres / totalMetres) * totalMs);
        const started = performance.now();

        const tick = (now) => {
          if (!running) return;
          const t = Math.min(1, (now - started) / legMs);
          const metres = from + legMetres * t;
          const pos = pointAt(points, cum, metres);

          car.setLatLng(pos);
          trail.setLatLngs(points.slice(stopIdx[0], indexAt(cum, metres) + 1).concat([pos]));

          if (t < 1) {
            frame = requestAnimationFrame(tick);
          } else {
            const stop = driven[legIndex + 1];
            milesSoFar += stop.mileage || 0;
            litUp(stop);
            showHud(stop, milesSoFar);
            timers.push(setTimeout(() => runLeg(legIndex + 1), PAUSE_AT_STOP_MS));
          }
        };

        frame = requestAnimationFrame(tick);
      }

      function stepThroughStops(points, stopIdx, miles) {
        // Reduced-motion path: hop from stop to stop, no tweening.
        let i = 1;
        const hop = () => {
          if (!running || i >= driven.length) return finish();
          const stop = driven[i];
          miles += stop.mileage || 0;
          car.setLatLng(points[stopIdx[i]]);
          trail.setLatLngs(points.slice(stopIdx[0], stopIdx[i] + 1));
          litUp(stop);
          showHud(stop, miles);
          i++;
          timers.push(setTimeout(hop, 700));
        };
        timers.push(setTimeout(hop, 700));
      }
    }

    function indexAt(cum, metres) {
      let i = 0;
      while (i < cum.length - 1 && cum[i + 1] < metres) i++;
      return i;
    }

    // Reached the end under its own steam: leave the HUD on the last stop for
    // a moment so the final number is readable, then tidy up.
    function finish() {
      timers.push(setTimeout(stop, 1600));
    }

    function stop() {
      running = false;
      setButton(false);
      document.removeEventListener("keydown", onKey);

      if (frame) cancelAnimationFrame(frame);
      frame = null;
      timers.forEach(clearTimeout);
      timers = [];

      if (car) { map.removeLayer(car); car = null; }
      if (trail) { map.removeLayer(trail); trail = null; }

      restorePins();
      hud.hidden = true;
      hud.innerHTML = "";
    }
  };
})();
