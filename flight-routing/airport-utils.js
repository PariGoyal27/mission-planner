/* ============================================================
   AIRPORT UTILITIES
   ────────────────────────────────────────────────────────────
   Lookup helpers built on top of the AIRPORTS dataset
   (airports-data.js, which must be loaded first).

   EXPORTS (global functions, no modules):
     findAirportByCity(city)      → airport object | null
     findNearestAirport(lat, lon) → { airport, distanceKm } | null
     getHubAirports()             → array of hub airport objects

   These are pure, synchronous, dependency-free functions —
   no fetch calls, no external libraries. They are intended to
   be consumed by airport-graph.js and the route engine.
   ════════════════════════════════════════════════════════════
   */

/* ──────────────────────────────────────────────────────────
   _haversineKm — Great-circle distance between two lat/lng
   points, in kilometres. Local copy kept here so this module
   has no load-order dependency on agents.js. Mirrors the
   existing haversineKm() formula used elsewhere in the project
   (Earth radius 6371 km).
   ────────────────────────────────────────────────────────── */
function _haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Earth's mean radius in km

  var dLat = _toRad(lat2 - lat1);
  var dLon = _toRad(lon2 - lon1);

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(_toRad(lat1)) *
      Math.cos(_toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // unrounded — callers round as needed
}

function _toRad(deg) {
  return deg * (Math.PI / 180);
}

/* ──────────────────────────────────────────────────────────
   _normalize — lowercase + trim a string for case/whitespace
   -insensitive comparisons.
   ────────────────────────────────────────────────────────── */
function _normalize(str) {
  return (str || "").toString().trim().toLowerCase();
}

/* ──────────────────────────────────────────────────────────
   findAirportByCity(city)
   ────────────────────────────────────────────────────────────
   Finds an airport serving the given city name.

   Matching strategy (in order):
     1. Exact match on airport.city (case/whitespace-insensitive)
     2. Exact match on airport.code (lets callers pass an IATA
        code directly, e.g. "DEL", as a convenience/escape hatch)
     3. Substring match — city name contains the query or the
        query contains the city name (handles inputs like
        "New Delhi, India" or "Bombay" vs "Mumbai" being out of
        scope — substring only covers naming variants, not
        true aliases)

   If multiple airports serve the same city (e.g. Goa has GOI
   and GOX), the hub airport is preferred; if there's a tie,
   the first match in dataset order is returned.

   Returns the matching airport object, or null if none found.
   ────────────────────────────────────────────────────────── */
function findAirportByCity(city) {
  if (!city) return null;
  var query = _normalize(city);
  if (!query) return null;

  var candidates = [];

  // Pass 1: exact city name match
  for (var i = 0; i < AIRPORTS.length; i++) {
    if (_normalize(AIRPORTS[i].city) === query) {
      candidates.push(AIRPORTS[i]);
    }
  }

  // Pass 2: exact IATA code match (only if no city match found)
  if (candidates.length === 0) {
    for (var j = 0; j < AIRPORTS.length; j++) {
      if (_normalize(AIRPORTS[j].code) === query) {
        candidates.push(AIRPORTS[j]);
      }
    }
  }

  // Pass 3: substring match (only if still nothing found)
  if (candidates.length === 0) {
    for (var k = 0; k < AIRPORTS.length; k++) {
      var airportCity = _normalize(AIRPORTS[k].city);
      if (airportCity.indexOf(query) !== -1 || query.indexOf(airportCity) !== -1) {
        candidates.push(AIRPORTS[k]);
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple airports for this city — prefer the hub
  var hub = candidates.find(function (a) { return a.isHub; });
  return hub || candidates[0];
}

/* ──────────────────────────────────────────────────────────
   findNearestAirport(lat, lon)
   ────────────────────────────────────────────────────────────
   Finds the geographically nearest airport to a given
   coordinate, by straight-line (Haversine) distance.

   Useful as a fallback when findAirportByCity() fails to match
   a city name but geocoded coordinates are already available
   (e.g. from mapsAgent's existing ORS geocoding step).

   Params:
     lat, lon → decimal degrees (WGS84)

   Returns:
     { airport: <airport object>, distanceKm: <number> }
     or null if the AIRPORTS dataset is empty / inputs invalid.
   ────────────────────────────────────────────────────────── */
function findNearestAirport(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (isNaN(lat) || isNaN(lon)) return null;
  if (!AIRPORTS || AIRPORTS.length === 0) return null;

  var nearest = null;
  var nearestDist = Infinity;

  for (var i = 0; i < AIRPORTS.length; i++) {
    var a = AIRPORTS[i];
    var d = _haversineKm(lat, lon, a.latitude, a.longitude);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = a;
    }
  }

  if (!nearest) return null;

  return {
    airport: nearest,
    distanceKm: Math.round(nearestDist * 10) / 10, // 1 decimal place
  };
}

/* ──────────────────────────────────────────────────────────
   getHubAirports()
   ────────────────────────────────────────────────────────────
   Returns all airports flagged isHub: true.

   Used by airport-graph.js to build hub↔hub edges (every hub
   connects to every other hub) as distinct from regional
   airports, which only connect to their nearest hub(s).

   Returns a new array (safe to filter/sort without mutating
   the frozen AIRPORTS dataset).
   ────────────────────────────────────────────────────────── */
function getHubAirports() {
  return AIRPORTS.filter(function (a) { return a.isHub === true; });
}
