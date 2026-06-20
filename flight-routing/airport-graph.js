/* ============================================================
   AIRPORT GRAPH
   ────────────────────────────────────────────────────────────
   Builds a weighted adjacency-list graph over the AIRPORTS
   dataset (airports-data.js, which must be loaded first),
   using airport-utils.js for distance calculation.

   CONNECTIVITY RULES:
     1. Regional (non-hub) airports connect to their 2 nearest
        hub airports.
     2. Hub airports do NOT connect to every other hub. Instead
        they follow a curated, airline-style route map
        (HUB_ROUTE_MAP below) — the same pattern real carriers
        use: regional hubs feed into long-haul super-hubs,
        rather than every city pair having a direct flight.
        This is what allows Dijkstra to surface realistic
        layovers instead of always finding a direct hub-to-hub
        edge.
     3. Edge weights = Haversine distance (km) between the
        two airports' coordinates.

   The graph is built fresh from AIRPORTS each time
   buildAirportGraph() is called — there is no persisted/cached
   graph file. This keeps it automatically in sync whenever
   airports-data.js is extended (regional airports re-attach
   automatically; new hubs should be added to HUB_ROUTE_MAP
   below to participate in the curated network).

   EXPORTS (global functions, no modules):
     buildAirportGraph()   → graph object (see OUTPUT FORMAT)
     validateGraph(graph)  → boolean

   OUTPUT FORMAT:
     {
       "DEL": [
         { airport: "DXB", distanceKm: 2190 },
         { airport: "LHR", distanceKm: 6700 }
       ],
       ...
     }

   Keys are IATA airport codes. Each value is an array of
   neighbor edges. Edges are undirected — if A connects to B,
   B also gets an edge back to A with the same weight.
   ════════════════════════════════════════════════════════════
   */

/* Number of nearest hubs a regional airport connects to */
var REGIONAL_TO_HUB_EDGE_COUNT = 2;

/* ──────────────────────────────────────────────────────────
   HUB_ROUTE_MAP — Curated airline-style hub-to-hub network.
   ────────────────────────────────────────────────────────────
   Replaces "every hub connects to every hub" with a hand-picked
   set of routes modeled loosely on real-world airline networks:

     - Indian metro hubs connect to nearby long-haul gateway
       hubs (Gulf carriers, Southeast Asia) rather than flying
       direct to every Western city.
     - Gulf hubs (DXB/AUH/DOH) act as long-haul connectors
       onward to Europe and North America — the real-world role
       these airports play (e.g. Emirates/Etihad/Qatar Airways
       hub-and-spoke model).
     - European hubs (LHR/CDG/FRA/AMS/IST) interconnect with
       each other and onward to North America.
     - Singapore/Bangkok/Kuala Lumpur/Hong Kong connect South
       and Southeast Asia onward to East Asia and Australia.

   Each entry lists ONE direction; _buildHubEdges() below adds
   the reverse edge automatically, so a pair only needs to be
   listed once.

   This is a hand-curated reference map for trip-estimation
   realism, not a live airline schedule — extend it as more
   hubs are added to airports-data.js.
   ────────────────────────────────────────────────────────── */
var HUB_ROUTE_MAP = [
  /* ── India: domestic metro hubs interconnect directly ── */
  /* (realistic — DEL/BOM/BLR/MAA/CCU/HYD/AMD/COK are among the ──
     busiest point-to-point domestic routes in the world; unlike ──
     international long-haul, domestic Indian aviation is NOT ──
     strictly hub-and-spoke) */
  ["DEL", "BOM"], ["DEL", "BLR"], ["DEL", "MAA"], ["DEL", "CCU"],
  ["DEL", "HYD"], ["DEL", "AMD"], ["DEL", "COK"],
  ["BOM", "BLR"], ["BOM", "MAA"], ["BOM", "CCU"], ["BOM", "HYD"],
  ["BOM", "AMD"], ["BOM", "COK"],
  ["BLR", "MAA"], ["BLR", "CCU"], ["BLR", "HYD"], ["BLR", "COK"],
  ["MAA", "CCU"], ["MAA", "HYD"], ["MAA", "COK"],
  ["CCU", "HYD"],
  ["HYD", "COK"],

  /* ── India ↔ Gulf / Southeast Asia gateways ── */
  ["DEL", "DXB"], ["DEL", "AUH"], ["DEL", "DOH"],
  ["DEL", "SIN"], ["DEL", "BKK"], ["DEL", "LHR"],

  ["BOM", "DXB"], ["BOM", "AUH"], ["BOM", "DOH"],
  ["BOM", "SIN"], ["BOM", "LHR"],

  ["BLR", "DXB"], ["BLR", "SIN"], ["BLR", "KUL"],

  ["MAA", "DXB"], ["MAA", "SIN"], ["MAA", "KUL"],

  ["CCU", "DXB"], ["CCU", "BKK"], ["CCU", "SIN"],

  ["HYD", "DXB"], ["HYD", "DOH"],

  ["AMD", "DXB"], ["AMD", "DOH"],

  ["COK", "DXB"], ["COK", "AUH"], ["COK", "DOH"],

  /* ── Gulf hubs interconnect, and feed onward long-haul ── */
  ["DXB", "AUH"], ["DXB", "DOH"],
  ["DXB", "LHR"], ["DXB", "CDG"], ["DXB", "FRA"], ["DXB", "JFK"],
  ["AUH", "LHR"], ["AUH", "FRA"],
  ["DOH", "LHR"], ["DOH", "CDG"],

  /* ── European hubs interconnect ── */
  ["LHR", "CDG"], ["LHR", "FRA"], ["LHR", "AMS"], ["LHR", "JFK"],
  ["CDG", "FRA"], ["CDG", "AMS"], ["CDG", "IST"],
  ["FRA", "AMS"], ["FRA", "IST"], ["FRA", "JFK"],
  ["AMS", "IST"],
  ["IST", "DXB"],

  /* ── North America interconnect ── */
  ["JFK", "LAX"], ["JFK", "ORD"],
  ["LAX", "ORD"], ["LAX", "SYD"], ["LAX", "NRT"], ["LAX", "HKG"],

  /* ── Southeast / East Asia / Pacific ── */
  ["SIN", "BKK"], ["SIN", "KUL"], ["SIN", "HKG"],
  ["SIN", "SYD"], ["SIN", "NRT"], ["SIN", "ICN"],
  ["BKK", "HKG"], ["BKK", "ICN"],
  ["KUL", "HKG"],
  ["HKG", "NRT"], ["HKG", "ICN"],
  ["NRT", "ICN"], ["NRT", "SYD"],
];

/* ──────────────────────────────────────────────────────────
   _graphHaversineKm — Great-circle distance between two
   airport objects, in kilometres (rounded to nearest integer
   to match the output format example).

   Kept as a local helper (rather than depending on agents.js)
   so this module only depends on airports-data.js and
   airport-utils.js, consistent with the existing project's
   pattern of small, loosely-coupled files.
   ────────────────────────────────────────────────────────── */
function _graphHaversineKm(airportA, airportB) {
  var R = 6371; // Earth's mean radius in km

  var lat1 = airportA.latitude, lon1 = airportA.longitude;
  var lat2 = airportB.latitude, lon2 = airportB.longitude;

  var dLat = (lat2 - lat1) * (Math.PI / 180);
  var dLon = (lon2 - lon1) * (Math.PI / 180);

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/* ──────────────────────────────────────────────────────────
   _addEdge — Adds a single directed edge (from → to) to the
   graph, skipping self-edges and duplicate edges to the same
   neighbor.
   ────────────────────────────────────────────────────────── */
function _addEdge(graph, fromCode, toCode, distanceKm) {
  if (fromCode === toCode) return; // no self-edges

  if (!graph[fromCode]) graph[fromCode] = [];

  // Skip if this edge already exists (avoids duplicates when a
  // regional airport's 2-nearest-hubs set overlaps with edges
  // added from another pass)
  var alreadyExists = graph[fromCode].some(function (edge) {
    return edge.airport === toCode;
  });
  if (alreadyExists) return;

  graph[fromCode].push({ airport: toCode, distanceKm: distanceKm });
}

/* ──────────────────────────────────────────────────────────
   _addUndirectedEdge — Adds edges in both directions with the
   same weight (flight distance is symmetric A→B / B→A).
   ────────────────────────────────────────────────────────── */
function _addUndirectedEdge(graph, codeA, codeB, distanceKm) {
  _addEdge(graph, codeA, codeB, distanceKm);
  _addEdge(graph, codeB, codeA, distanceKm);
}

/* ──────────────────────────────────────────────────────────
   _findAirportByCode — Looks up a full airport object from
   AIRPORTS by its IATA code. Used to resolve HUB_ROUTE_MAP
   entries (which store codes) into coordinates for distance
   calculation.
   ────────────────────────────────────────────────────────── */
function _findAirportByCode(code) {
  for (var i = 0; i < AIRPORTS.length; i++) {
    if (AIRPORTS[i].code === code) return AIRPORTS[i];
  }
  return null;
}

/* ──────────────────────────────────────────────────────────
   _buildHubEdges — Adds hub↔hub edges to the graph based on
   HUB_ROUTE_MAP, instead of connecting every hub to every
   other hub. Each [codeA, codeB] pair in the map becomes one
   undirected edge, weighted by Haversine distance.

   Entries referencing a code not present in AIRPORTS (e.g. a
   typo, or a hub later removed from the dataset) are silently
   skipped rather than breaking graph construction — this keeps
   buildAirportGraph() defensive/non-throwing as required.
   ────────────────────────────────────────────────────────── */
function _buildHubEdges(graph) {
  for (var i = 0; i < HUB_ROUTE_MAP.length; i++) {
    var pair = HUB_ROUTE_MAP[i];
    var codeA = pair[0];
    var codeB = pair[1];

    var airportA = _findAirportByCode(codeA);
    var airportB = _findAirportByCode(codeB);

    if (!airportA || !airportB) continue; // unknown code — skip safely

    var dist = _graphHaversineKm(airportA, airportB);
    _addUndirectedEdge(graph, codeA, codeB, dist);
  }
}

/* ──────────────────────────────────────────────────────────
   buildAirportGraph()
   ────────────────────────────────────────────────────────────
   Builds and returns the full weighted adjacency-list graph,
   per the connectivity rules described above.

   IMPORTANT — regional airports are leaf nodes only:
   A regional airport's edge to its nearest hub(s) is added in
   BOTH directions so it is reachable as a trip's origin or
   destination. However, regional airports must never be used
   as a layover waypoint between two hubs (real itineraries
   don't route a Delhi-to-Dubai passenger through a small
   regional airport just because the great-circle math makes
   it look shorter). To enforce this, a regional airport's
   outbound edges only ever lead to its 2 nearest hubs — it has
   no edges to other regional airports — so Dijkstra can reach
   it but can never use it as a stepping-stone to somewhere
   else, since leaving it again only goes back to a hub it
   could have reached directly.

   Defensive behavior:
     - If AIRPORTS is missing, empty, or malformed, returns an
       empty object ({}) rather than throwing — callers should
       check the result with validateGraph() before using it.

   Returns: graph object (see OUTPUT FORMAT above)
   ────────────────────────────────────────────────────────── */
function buildAirportGraph() {
  var graph = {};

  if (typeof AIRPORTS === "undefined" || !Array.isArray(AIRPORTS) || AIRPORTS.length === 0) {
    return graph; // empty graph — validateGraph() will catch this
  }

  // Ensure every known airport has at least an empty entry,
  // so isolated airports (no edges yet) still appear as nodes.
  AIRPORTS.forEach(function (a) {
    if (a && a.code) graph[a.code] = graph[a.code] || [];
  });

  var hubs = (typeof getHubAirports === "function")
    ? getHubAirports()
    : AIRPORTS.filter(function (a) { return a.isHub === true; });

  // ── Rule 2: hubs connect per the curated HUB_ROUTE_MAP, ──
  // ── NOT every hub to every other hub ──
  _buildHubEdges(graph);

  // ── Rule 1: each regional airport connects to its 2 nearest hubs ──
  // NOTE: regional → hub edges only (never regional → regional),
  // so regional airports can be reached but never used as a
  // mid-route layover shortcut between two hubs. See note above.
  var regionalAirports = AIRPORTS.filter(function (a) { return !a.isHub; });

  regionalAirports.forEach(function (regional) {
    if (hubs.length === 0) return; // no hubs exist — nothing to connect to

    // Compute distance from this regional airport to every hub,
    // then take the N closest.
    var hubDistances = hubs.map(function (hub) {
      return { hub: hub, distanceKm: _graphHaversineKm(regional, hub) };
    });

    hubDistances.sort(function (a, b) { return a.distanceKm - b.distanceKm; });

    var nearestHubs = hubDistances.slice(0, REGIONAL_TO_HUB_EDGE_COUNT);

    nearestHubs.forEach(function (entry) {
      _addUndirectedEdge(graph, regional.code, entry.hub.code, entry.distanceKm);
    });
  });

  return graph;
}

/* ──────────────────────────────────────────────────────────
   validateGraph(graph)
   ────────────────────────────────────────────────────────────
   Validates that a graph object is well-formed and usable by
   the route engine.

   Checks performed:
     1. graph exists (not null/undefined)
     2. graph is a plain object (not an array, not a primitive)
     3. graph is not empty (has at least one node)
     4. every edge in every node references a code that is
        itself a valid key in the graph (no dangling references
        to unknown airports)
     5. every edge has a finite, non-negative distanceKm

   Returns: true if valid, false otherwise. Never throws.
   ────────────────────────────────────────────────────────── */
function validateGraph(graph) {
  try {
    // 1. exists
    if (!graph) return false;

    // 2. is a plain object, not an array
    if (typeof graph !== "object" || Array.isArray(graph)) return false;

    var nodeCodes = Object.keys(graph);

    // 3. not empty
    if (nodeCodes.length === 0) return false;

    // 4 + 5. every edge references a valid node and has a sane weight
    for (var i = 0; i < nodeCodes.length; i++) {
      var code = nodeCodes[i];
      var edges = graph[code];

      if (!Array.isArray(edges)) return false;

      for (var j = 0; j < edges.length; j++) {
        var edge = edges[j];

        if (!edge || typeof edge !== "object") return false;
        if (typeof edge.airport !== "string" || !edge.airport) return false;
        if (typeof edge.distanceKm !== "number") return false;
        if (isNaN(edge.distanceKm) || !isFinite(edge.distanceKm)) return false;
        if (edge.distanceKm < 0) return false;

        // Dangling reference: edge points to a code with no node entry
        if (graph[edge.airport] === undefined) return false;
      }
    }

    return true;
  } catch (e) {
    // Defensive: any unexpected shape should fail validation,
    // not throw and break the caller.
    return false;
  }
}
