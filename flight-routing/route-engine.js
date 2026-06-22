/* ============================================================
   ROUTE ENGINE
   ────────────────────────────────────────────────────────────
   Computes the shortest-by-distance flight route between two
   airports using Dijkstra's algorithm over the graph produced
   by airport-graph.js (buildAirportGraph / validateGraph).

   EXPORTS (global function, no modules):
     findBestRoute(originAirportCode, destinationAirportCode)

   This module never throws raw JavaScript errors out to the
   caller — every failure path returns the structured response
   object described below, with success:false and a specific
   error code. This matches the existing project's pattern
   (see agents.js / showApiError) of surfacing clear, specific
   failures rather than silently failing or crashing the
   orchestrator.
   ════════════════════════════════════════════════════════════
   */

/* ──────────────────────────────────────────────────────────
   _emptyResult(errorCode) — Builds the standard failure
   response shape so every error path returns an identically
   structured object.
   ────────────────────────────────────────────────────────── */
function _emptyResult(errorCode) {
  return {
    success: false,
    route: [],
    totalDistanceKm: 0,
    layoverCount: 0,
    error: errorCode,
  };
}

/* ──────────────────────────────────────────────────────────
   _dijkstra(graph, startCode, endCode)
   ────────────────────────────────────────────────────────────
   Internal Dijkstra implementation. Assumes the graph has
   already been validated by the caller.

   Returns:
     { path: [codes...], totalDistanceKm: number }  on success
     null                                            if no path exists
   ────────────────────────────────────────────────────────── */
function _dijkstra(graph, startCode, endCode) {
  var distances = {};   // code -> shortest known distance from start
  var previous = {};    // code -> previous code on the shortest path
  var visited = {};      // code -> true once finalized
  var nodeCodes = Object.keys(graph);

  nodeCodes.forEach(function (code) {
    distances[code] = Infinity;
  });
  distances[startCode] = 0;

  // Simple O(V^2) Dijkstra using a linear scan to find the
  // closest unvisited node each iteration. The graph here has
  // at most a few hundred nodes, so a priority queue is not
  // necessary for acceptable performance.
  for (var iteration = 0; iteration < nodeCodes.length; iteration++) {
    var currentCode = null;
    var currentDist = Infinity;

    for (var i = 0; i < nodeCodes.length; i++) {
      var code = nodeCodes[i];
      if (!visited[code] && distances[code] < currentDist) {
        currentDist = distances[code];
        currentCode = code;
      }
    }

    // No reachable unvisited node left
    if (currentCode === null) break;

    // Early exit once we've finalized the destination
    if (currentCode === endCode) break;

    visited[currentCode] = true;

    var edges = graph[currentCode] || [];
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      var neighbor = edge.airport;

      if (visited[neighbor]) continue;
      if (distances[neighbor] === undefined) continue; // neighbor not a known node

      var candidateDist = distances[currentCode] + edge.distanceKm;
      if (candidateDist < distances[neighbor]) {
        distances[neighbor] = candidateDist;
        previous[neighbor] = currentCode;
      }
    }
  }

  if (distances[endCode] === undefined || distances[endCode] === Infinity) {
    return null; // unreachable
  }

  // Reconstruct path by walking back through `previous`
  var path = [];
  var step = endCode;
  while (step !== undefined) {
    path.unshift(step);
    if (step === startCode) break;
    step = previous[step];
  }

  // Defensive: path reconstruction failed to reach startCode
  if (path[0] !== startCode) return null;

  return {
    path: path,
    totalDistanceKm: distances[endCode],
  };
}

/* ──────────────────────────────────────────────────────────
   findBestRoute(originAirportCode, destinationAirportCode)
   ────────────────────────────────────────────────────────────
   Computes the shortest-distance route between two airports
   (by IATA code) through the airport graph, allowing layovers
   at intermediate hub/regional airports per the graph's
   connectivity rules.

   Params:
     originAirportCode      → IATA code string, e.g. "LKO"
     destinationAirportCode → IATA code string, e.g. "CDG"

   Returns a structured response object — always one of:

     Success:
       {
         success: true,
         route: ["LKO","DEL","DXB","CDG"],
         totalDistanceKm: 7420,
         layoverCount: 2,
         error: null
       }

     Failure (error is one of):
       "AIRPORT_NOT_FOUND" → origin or destination code not in graph
       "NO_ROUTE_FOUND"    → both airports exist but no path connects them
       "INVALID_GRAPH"     → graph could not be built or failed validation

   This function never throws — all failure modes are caught
   and returned as structured objects.
   ────────────────────────────────────────────────────────── */
function findBestRoute(originAirportCode, destinationAirportCode) {
  try {
    // ── Input sanity check ──
    if (
      typeof originAirportCode !== "string" || !originAirportCode.trim() ||
      typeof destinationAirportCode !== "string" || !destinationAirportCode.trim()
    ) {
      return _emptyResult("AIRPORT_NOT_FOUND");
    }

    var originCode = originAirportCode.trim().toUpperCase();
    var destCode = destinationAirportCode.trim().toUpperCase();

    // ── Build + validate the graph ──
    var graph;
    try {
      graph = buildAirportGraph();
    } catch (buildErr) {
      return _emptyResult("INVALID_GRAPH");
    }

    if (!validateGraph(graph)) {
      return _emptyResult("INVALID_GRAPH");
    }

    // ── Confirm both airports exist as nodes in the graph ──
    if (!graph.hasOwnProperty(originCode) || !graph.hasOwnProperty(destCode)) {
      return _emptyResult("AIRPORT_NOT_FOUND");
    }

    // ── Same-airport edge case: trivially "reachable" with zero distance ──
    if (originCode === destCode) {
      return {
        success: true,
        route: [originCode],
        totalDistanceKm: 0,
        layoverCount: 0,
        error: null,
      };
    }

    // ── Run Dijkstra ──
    var result = _dijkstra(graph, originCode, destCode);

    if (!result) {
      return _emptyResult("NO_ROUTE_FOUND");
    }

    // layoverCount = number of intermediate stops = path length - 2
    // (origin and destination are not layovers)
    var layoverCount = Math.max(0, result.path.length - 2);

    return {
      success: true,
      route: result.path,
      totalDistanceKm: Math.round(result.totalDistanceKm),
      layoverCount: layoverCount,
      error: null,
    };
  } catch (unexpectedErr) {
    // Final safety net — should not normally be reachable given the
    // checks above, but guarantees this function never throws.
    return _emptyResult("INVALID_GRAPH");
  }
}
