/*
  route.js — turns the straight lines between stops into the roads you
  actually drove.

  The site's own data only has a latitude/longitude per stop, so a line drawn
  straight from one to the next cuts across mountains, lakes and state lines.
  This asks the public OSRM routing service for real driving geometry between
  those same points instead.

  Three things matter about how it's wired up:

   1. It never blocks the map. map.js draws the straight lines first and swaps
      in the road geometry if and when it arrives.
   2. It never fails. Every error path — offline, timeout, service down, a bad
      response — resolves with the straight coordinates that were passed in,
      which is exactly what the map was already showing.
   3. It only asks once per route. Results are cached in sessionStorage, so
      clicking through to Photos and back doesn't re-hit a free public service.
*/
(function () {
  const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";
  const TIMEOUT_MS = 6000;

  // The public demo server won't route an unbounded number of waypoints, and a
  // very long trip isn't worth pushing at it. Past this, keep straight lines.
  const MAX_WAYPOINTS = 25;

  const CACHE_PREFIX = "roadtrip.route.";

  function cacheKey(coords) {
    return CACHE_PREFIX + coords.map((c) => c[0].toFixed(4) + "," + c[1].toFixed(4)).join(";");
  }

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; // private browsing, storage full, corrupt entry — all fine, just re-fetch
    }
  }

  function writeCache(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage is a nicety here, never a requirement */
    }
  }

  /*
    coords is a list of [lat, lng] pairs — the stops, in order. Resolves with a
    denser list of [lat, lng] pairs following the roads, or with `coords`
    unchanged if that can't be had.
  */
  App.fetchRoadRoute = function (coords) {
    if (!Array.isArray(coords) || coords.length < 2 || coords.length > MAX_WAYPOINTS) {
      return Promise.resolve(coords);
    }

    const key = cacheKey(coords);
    const cached = readCache(key);
    if (cached) return Promise.resolve(cached);

    // OSRM takes lng,lat — the opposite order from Leaflet's lat,lng.
    const path = coords.map((c) => c[1].toFixed(5) + "," + c[0].toFixed(5)).join(";");
    const url = OSRM_BASE + path + "?overview=full&geometries=geojson";

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), TIMEOUT_MS);

    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((r) => {
        if (!r.ok) throw new Error("routing service returned " + r.status);
        return r.json();
      })
      .then((data) => {
        const line = data && data.routes && data.routes[0] && data.routes[0].geometry;
        if (!line || !Array.isArray(line.coordinates) || line.coordinates.length < 2) {
          throw new Error("no usable geometry in response");
        }
        const latLngs = line.coordinates.map((c) => [c[1], c[0]]);
        writeCache(key, latLngs);
        return latLngs;
      })
      .catch(() => coords) // straight lines are a perfectly good fallback
      .then((result) => {
        clearTimeout(timer);
        return result;
      });
  };
})();
