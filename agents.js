/* 
   AGENT 1: WEATHER AGENT
   ───────────────────────────────────────────────────────────
   WHAT THIS DOES:
   Calls two OpenWeatherMap endpoints:

   1) /weather  → current conditions (always available)
      Reliable fallback if trip is > 5 days away.

   2) /forecast → 5-day / 3-hour forecast
      We filter entries that fall within your trip dates.
      If the trip is more than 5 days from today,
      this returns nothing — so we fall back to /weather.

   FIX applied:
   - Separate fetch for /weather (not just /forecast)
   - isEstimate flag shown on cards for future dates
   - Clear 401 / 404 error messages
    */
async function weatherAgent(city, startDate, endDate) {
  setAgent("weather", "running");
  addLog("[ WEATHER ] Fetching live weather for: " + city + "...");

  if (!WEATHER_API_KEY || WEATHER_API_KEY === "YOUR_OPENWEATHERMAP_KEY_HERE") {
    addLog("[ WEATHER ] No API key — showing demo data", "log-warn");
    setAgent("weather", "done");
    return buildMockWeather(startDate, endDate);
  }

  try {
    // ── Current weather fetch ──
    var curURL =
      "https://api.openweathermap.org/data/2.5/weather?q=" +
      encodeURIComponent(city) +
      "&appid=" +
      WEATHER_API_KEY +
      "&units=metric";
    var curController = new AbortController();
    var curTimeout = setTimeout(function () { curController.abort(); }, 10000);
    var curRes;
    try {
      curRes = await fetch(curURL, { signal: curController.signal });
    } catch (curFetchErr) {
      if (curFetchErr.name === "AbortError") {
        throw new Error("Weather request timed out. Check your connection and try again.");
      }
      throw curFetchErr;
    } finally {
      clearTimeout(curTimeout);
    }

    if (!curRes.ok) {
      var curErr = await curRes.json().catch(function () {
        return {};
      });
      if (curRes.status === 401)
        throw new Error(
          "Invalid OpenWeatherMap API key. Check and re-paste it.",
        );
      if (curRes.status === 404)
        throw new Error(
          'City not found: "' +
            city +
            '". Try full name e.g. Mumbai, New Delhi.',
        );
      throw new Error(
        "Weather error " + curRes.status + ": " + (curErr.message || "unknown"),
      );
    }

    var curData = await curRes.json();
    addLog(
      "[ WEATHER ] Current: " +
        curData.weather[0].description +
        ", " +
        Math.round(curData.main.temp) +
        "°C",
    );

    // ── 5-day forecast fetch ──
    var fcURL =
      "https://api.openweathermap.org/data/2.5/forecast?q=" +
      encodeURIComponent(city) +
      "&appid=" +
      WEATHER_API_KEY +
      "&units=metric&cnt=40";
    var fcController = new AbortController();
    var fcTimeout = setTimeout(function () { fcController.abort(); }, 10000);
    var fcData = null;
    try {
      var fcRes = await fetch(fcURL, { signal: fcController.signal });
      if (fcRes.ok) {
        fcData = await fcRes.json();
      } else {
        addLog(
          "[ WEATHER ] Forecast request failed (HTTP " + fcRes.status + ") — using current weather as estimate.",
          "log-warn",
        );
      }
    } catch (fcErr) {
      var fcErrMsg = fcErr.name === "AbortError" ? "timed out" : fcErr.message;
      addLog(
        "[ WEATHER ] Forecast request failed (" + fcErrMsg + ") — using current weather as estimate.",
        "log-warn",
      );
    } finally {
      clearTimeout(fcTimeout);
    }

    // ── Group forecast by date ──
    var startD = new Date(startDate + "T00:00:00");
    var endD = new Date(endDate + "T23:59:59");
    var dayMap = {};

    if (fcData && fcData.list) {
      fcData.list.forEach(function (entry) {
        var dt = new Date(entry.dt * 1000);
        var key = dt.toISOString().split("T")[0];
        if (dt >= startD && dt <= endD) {
          if (!dayMap[key])
            dayMap[key] = {
              temps: [],
              descs: [],
              winds: [],
              hums: [],
              icons: [],
            };
          dayMap[key].temps.push(entry.main.temp);
          dayMap[key].descs.push(entry.weather[0].description);
          dayMap[key].winds.push(entry.wind.speed);
          dayMap[key].hums.push(entry.main.humidity);
          dayMap[key].icons.push(entry.weather[0].icon);
        }
      });
    }

    var tripDays = getDaysBetween(startDate, endDate);
    var usedEstimate = false;

    var result = tripDays.map(function (dateStr) {
      var found = dayMap[dateStr];
      var temp, desc, wind, hum, icon;

      if (found && found.temps.length > 0) {
        temp = Math.round(avgArr(found.temps));
        desc = found.descs[Math.floor(found.descs.length / 2)];
        wind = Math.round(avgArr(found.winds));
        hum = Math.round(avgArr(found.hums));
        icon = found.icons[0];
      } else {
        // Fall back to current weather
        usedEstimate = true;
        temp = Math.round(curData.main.temp);
        desc = curData.weather[0].description;
        wind = Math.round(curData.wind.speed);
        hum = curData.main.humidity;
        icon = curData.weather[0].icon;
      }

      var isHazardous =
        desc.includes("storm") ||
        desc.includes("thunder") ||
        desc.includes("heavy rain") ||
        desc.includes("tornado") ||
        wind > 15;

      return {
        date: dateStr,
        temp: temp,
        description: desc,
        windSpeed: wind,
        humidity: hum,
        icon: icon,
        isHazardous: isHazardous,
        isEstimate: !found,
        emoji: getWeatherEmoji(desc),
      };
    });

    if (usedEstimate) {
      addLog(
        "[ WEATHER ] Trip is >5 days out. Future days show current weather as estimate.",
        "log-warn",
      );
    }

    setAgent("weather", "done");
    addLog("[ WEATHER ] ✓ " + result.length + " day(s) ready.", "log-ok");
    return result;
  } catch (e) {
    setAgent("weather", "error");
    addLog("[ WEATHER ] ERROR: " + e.message, "log-error");
    // Weather errors don't abort the whole mission — we show a warning card
    // instead of fake data, and let the user decide. The route/budget/plan
    // will still be generated with an empty weather array.
    showApiError(
      "Weather Agent",
      e.message +
        " — Weather data unavailable. Route & budget will still be calculated.",
    );
    return []; // empty array: plan still generates, weather card shows "no data"
  }
}

function buildMockWeather(startDate, endDate) {
  addLog("[ WEATHER ] Using demo forecast.", "log-warn");
  var days = getDaysBetween(startDate, endDate);
  var descs = [
    "clear sky",
    "few clouds",
    "scattered clouds",
    "light rain",
    "overcast clouds",
  ];
  return days.map(function (d, i) {
    return {
      date: d,
      temp: 26 + Math.floor(Math.random() * 8) - 3,
      description: descs[i % descs.length],
      windSpeed: 5 + Math.floor(Math.random() * 8),
      humidity: 55 + Math.floor(Math.random() * 20),
      icon: "01d",
      isHazardous: false,
      isEstimate: true,
      emoji: getWeatherEmoji(descs[i % descs.length]),
    };
  });
}

function getWeatherEmoji(desc) {
  if (!desc) return "🌤";
  var d = desc.toLowerCase();
  if (d.includes("thunder") || d.includes("storm")) return "⛈";
  if (d.includes("heavy rain")) return "🌧";
  if (d.includes("rain") || d.includes("drizzle")) return "🌦";
  if (d.includes("snow")) return "❄";
  if (d.includes("fog") || d.includes("mist")) return "🌫";
  if (d.includes("overcast")) return "☁";
  if (d.includes("cloud")) return "🌥";
  if (d.includes("clear")) return "☀";
  return "🌤";
}

/* 
   AGENT 2: MAPS AGENT
   ───────────────────────────────────────────────────────────
   WHAT THIS DOES:
   Step 1 — Geocoding both cities via ORS (Authorization header,
            not query string — more reliable, avoids CORS issues
            with some proxy setups).

   Step 2 — For CAR / TRAIN: fetch actual road directions from
            ORS to get real road distance and driving time.

   Step 3 — For FLIGHT: skip road directions entirely. Instead,
            compute the Haversine (great-circle) straight-line
            distance from the two coordinate pairs. Real flights
            travel the arc of the Earth, not roads — this gives
            a far more accurate air distance and therefore more
            realistic time + cost estimates.

   Distance semantics per mode:
     distanceKm      → the distance relevant for cost/time:
                        road km for car/train, aerial km for flight
     roadDistanceKm  → actual road km, always present (for plan text)
     aerialDistanceKm→ Haversine km (only for flight)
    */
async function mapsAgent(origin, destination, mode) {
  setAgent("maps", "running");
  addLog(
    "[ MAPS ] Route: " + origin + " → " + destination + " (" + mode + ")...",
  );

  // ── No API key: show error, do NOT silently fake data ──
  if (!ORS_API_KEY || ORS_API_KEY === "YOUR_OPENROUTESERVICE_KEY_HERE") {
    setAgent("maps", "error");
    var msg =
      "Maps API key not set. Open app.js and paste your OpenRouteService key into ORS_API_KEY.";
    addLog("[ MAPS ] ERROR: " + msg, "log-error");
    showApiError("Maps Agent", msg);
    throw new Error(msg); // bubble up to orchestrator to stop execution
  }

  try {
    // ── Step 1: Geocode both cities ──
    addLog('[ MAPS ] Geocoding "' + origin + '"...');
    var orgCoords = await geocodeCity(origin);

    addLog('[ MAPS ] Geocoding "' + destination + '"...');
    var dstCoords = await geocodeCity(destination);

    // geocodeCity returns null if the API responded but found nothing
    if (!orgCoords)
      throw new Error(
        'City not found: "' +
          origin +
          '". Try a major city name e.g. "Mumbai" or "New Delhi".',
      );
    if (!dstCoords)
      throw new Error(
        'City not found: "' + destination + '". Try a major city name.',
      );

    // ── Step 2: Aerial distance — routed through the airport graph ──
    // Tries Dijkstra-based multi-hop routing first (realistic layovers
    // via airport-graph.js / route-engine.js); falls back automatically
    // to the original Haversine straight-line distance if routing fails
    // for any reason (AIRPORT_NOT_FOUND / NO_ROUTE_FOUND / INVALID_GRAPH).
    var flightRoute = computeFlightDistance(
      origin,
      destination,
      orgCoords,
      dstCoords,
    );
    var aerialKm = flightRoute.aerialKm;

    if (flightRoute.usedRouting) {
      addLog(
        "[ MAPS ] ✓ Routed via airport graph: " +
          flightRoute.route.join(" → ") +
          " (" +
          flightRoute.layoverCount +
          " layover" +
          (flightRoute.layoverCount === 1 ? "" : "s") +
          ")",
        "log-ok",
      );
    } else {
      addLog(
        "[ MAPS ] Airport routing unavailable (" +
          flightRoute.fallbackReason +
          ") — using straight-line distance instead.",
        "log-warn",
      );
    }

    // ── Step 3: Road route (car & train only) ──
    // For flight we don't need road data — skip the directions call.
    var roadKm = null;
    var drivingHrs = null;

    if (mode === "car" || mode === "train") {
      addLog("[ MAPS ] Fetching road directions...");

      // ORS directions: use Authorization header (correct method per ORS docs)
      // Query-string api_key also works but header is the recommended approach.
      var dirURL =
        "https://api.openrouteservice.org/v2/directions/driving-car" +
        "?start=" +
        orgCoords[0] +
        "," +
        orgCoords[1] +
        "&end=" +
        dstCoords[0] +
        "," +
        dstCoords[1];

      var dirRes = await fetch(dirURL, {
        headers: { Authorization: ORS_API_KEY },
      });

      if (!dirRes.ok) {
        var dirErr = await dirRes.json().catch(function () {
          return {};
        });
        if (dirRes.status === 401)
          throw new Error(
            "Invalid ORS API key. Check it on openrouteservice.org → Dashboard.",
          );
        if (dirRes.status === 2010)
          throw new Error(
            "ORS: Could not find a road route between these cities.",
          );
        // ORS returns error details in dirErr.error.message
        var orsMsg =
          dirErr.error && dirErr.error.message
            ? dirErr.error.message
            : "HTTP " + dirRes.status;
        throw new Error("Maps directions error: " + orsMsg);
      }

      var dirData = await dirRes.json();
      if (!dirData.features || dirData.features.length === 0) {
        throw new Error(
          "No road route found. These cities may not be driveable (e.g. different islands).",
        );
      }

      var summary = dirData.features[0].properties.summary;
      roadKm = Math.round(summary.distance / 1000); // metres → km
      drivingHrs = Math.round((summary.duration / 3600) * 10) / 10; // seconds → hrs
    }

    // ── Step 4: Pick the right distance for each mode ──
    // car/train → road km (actual roads used)
    // flight    → aerial km (planes fly straight-line arcs)
    var distanceKm = mode === "flight" ? aerialKm : roadKm;

    // ── Step 5: Travel time per mode ──
    var travelHrs;
    if (mode === "car") {
      // Use ORS road time directly — it accounts for speed limits, junctions etc.
      travelHrs = drivingHrs;
    } else if (mode === "train") {
      // Average Indian express train ≈ 60 km/h + 2 hr station boarding buffer
      travelHrs = Math.round((roadKm / SPEED.train + 2) * 10) / 10;
    } else if (mode === "flight") {
      // Domestic Indian aircraft cruise ≈ 750 km/h + 3 hr airport overhead
      // (check-in 2 hr before + ~1 hr baggage/transit after landing)
      travelHrs = Math.round((aerialKm / SPEED.flight + 3) * 10) / 10;
    }

    setAgent("maps", "done");
    addLog(
      "[ MAPS ] ✓ " +
        (mode === "flight"
          ? "Aerial: " +
            aerialKm +
            " km | Road ref: " +
            (roadKm || "N/A") +
            " km"
          : "Road: " + distanceKm + " km") +
        " | " +
        mode +
        " travel time: " +
        travelHrs +
        " hrs",
      "log-ok",
    );

   return {
      distanceKm: distanceKm, // distance relevant to this mode (for cost calc)
      roadDistanceKm: roadKm, // always road km (may be null for flight if skipped)
      aerialDistanceKm: aerialKm, // straight-line km for car/train; routed km for flight when routing succeeds
      travelTimeHrs: travelHrs,
      drivingTimeHrs: drivingHrs, // ORS driving hrs (null for flight)
      orgCoords: orgCoords, // [lng, lat] — passed to budgetAgent for seeding
      dstCoords: dstCoords,
      origin: origin,
      destination: destination,
      mode: mode,
      // ── Existing routing fields ──
      flightRoute: mode === "flight" ? flightRoute.route : null, // ordered IATA codes, or null
      flightLayoverCount: mode === "flight" ? flightRoute.layoverCount : 0,
      flightUsedRouting: mode === "flight" ? flightRoute.usedRouting : false,
      // ── New, optional — safe to ignore by any consumer that doesn't know about them ──
      fallbackReason: mode === "flight" ? flightRoute.fallbackReason : null, // AIRPORT_NOT_FOUND / NO_ROUTE_FOUND / INVALID_GRAPH / null
      haversineDistanceKm: mode === "flight" ? haversineKm(orgCoords, dstCoords) : null, // plain straight-line km, always present for flight, for comparison even when routing succeeded
    };
  } catch (e) {
    setAgent("maps", "error");
    addLog("[ MAPS ] ERROR: " + e.message, "log-error");
    showApiError("Maps Agent", e.message);
    throw e; // re-throw so orchestrator stops and doesn't render partial results
  }
}

/* ──────────────────────────────────────────────────────────
   geocodeCity — City name → [lng, lat] via ORS Pelias geocoder
   Uses Authorization header (ORS recommended method).
   Returns null if city exists in API but yields zero results.
   Throws on network / auth errors.
   ────────────────────────────────────────────────────────── */
async function geocodeCity(city) {
  var url =
    "https://api.openrouteservice.org/geocode/search" +
    "?text=" +
    encodeURIComponent(city) +
    "&size=1" +
    "&layers=locality,county,region"; // prefer city-level results over streets

  var res = await fetch(url, {
    headers: { Authorization: ORS_API_KEY },
  });

  if (!res.ok) {
    var errData = await res.json().catch(function () {
      return {};
    });
    if (res.status === 401) throw new Error("Invalid ORS API key (geocoding).");
    var detail =
      errData.error && errData.error.message
        ? errData.error.message
        : "HTTP " + res.status;
    throw new Error('Geocoding error for "' + city + '": ' + detail);
  }

  var data = await res.json();
  if (!data.features || data.features.length === 0) return null;

  // ORS returns [longitude, latitude] — note the order
  return data.features[0].geometry.coordinates; // [lng, lat]
}

/* ──────────────────────────────────────────────────────────
   haversineKm — Great-circle distance between two [lng, lat] pairs
   Uses the Haversine formula, accurate to within ~0.5% for
   distances up to 20,000 km. Earth radius = 6371 km.
   ────────────────────────────────────────────────────────── */
function haversineKm(coordA, coordB) {
  var R = 6371; // Earth's mean radius in km
  var lng1 = coordA[0],
    lat1 = coordA[1];
  var lng2 = coordB[0],
    lat2 = coordB[1];

  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // km, rounded to nearest integer
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
/* ──────────────────────────────────────────────────────────
   computeFlightDistance — Routes a flight leg through the
   airport graph (airport-graph.js + route-engine.js) to get a
   realistic multi-hop distance instead of a raw straight line.

   Falls back automatically to the original Haversine distance
   if anything in the routing pipeline fails:
     - AIRPORT_NOT_FOUND  → origin/destination has no nearby airport
     - NO_ROUTE_FOUND     → airports exist but graph has no path
     - INVALID_GRAPH      → graph build/validation failed
     - any unexpected exception (defensive catch-all)

   Requires (already loaded via index.html, before agents.js):
     airports-data.js  → AIRPORTS
     airport-utils.js  → findAirportByCity, findNearestAirport
     airport-graph.js  → buildAirportGraph, validateGraph
     route-engine.js   → findBestRoute

   Params:
     origin, destination → original city name strings (as typed
                            by the user / passed into mapsAgent)
     orgCoords, dstCoords→ [lng, lat] pairs from geocodeCity
                            (ORS coordinate order)

   Returns:
     {
       aerialKm: number,        // routed distance, or Haversine fallback
       usedRouting: boolean,    // true if the airport graph was used
       route: array | null,     // ordered IATA codes, or null on fallback
       layoverCount: number,    // 0 when usedRouting is false
       fallbackReason: string|null  // one of the 3 error codes, or null
     }

   This function never throws — every failure path falls back to
   the existing Haversine calculation, so mapsAgent's behavior is
   never worse than it was before this integration.
   ────────────────────────────────────────────────────────── */
function computeFlightDistance(origin, destination, orgCoords, dstCoords) {
  // Always compute the original Haversine distance first — this is
  // both the fallback value AND kept for comparison/logging.
  var fallbackAerialKm = haversineKm(orgCoords, dstCoords);

  var result = {
    aerialKm: fallbackAerialKm,
    usedRouting: false,
    route: null,
    layoverCount: 0,
    fallbackReason: null,
  };

  // Guard: required routing functions/data not loaded for any reason
  // (e.g. script tag missing/out of order) — fall back immediately.
  if (
    typeof findAirportByCity !== "function" ||
    typeof findNearestAirport !== "function" ||
    typeof findBestRoute !== "function"
  ) {
    result.fallbackReason = "INVALID_GRAPH";
    return result;
  }

  try {
    // ── Resolve origin city → airport ──
    // Try direct city-name match first; if that fails, fall back to
    // nearest-airport-by-coordinate (using the already-geocoded coords).
    var originAirport = findAirportByCity(origin);
    if (!originAirport) {
      var nearestOrigin = findNearestAirport(orgCoords[1], orgCoords[0]); // [lng,lat] → (lat,lon)
      originAirport = nearestOrigin ? nearestOrigin.airport : null;
    }

    // ── Resolve destination city → airport (same strategy) ──
    var destAirport = findAirportByCity(destination);
    if (!destAirport) {
      var nearestDest = findNearestAirport(dstCoords[1], dstCoords[0]);
      destAirport = nearestDest ? nearestDest.airport : null;
    }

    if (!originAirport || !destAirport) {
      result.fallbackReason = "AIRPORT_NOT_FOUND";
      return result;
    }

    // ── Run the route engine ──
    var routeResult = findBestRoute(originAirport.code, destAirport.code);

    if (!routeResult || !routeResult.success) {
      // Surfaces NO_ROUTE_FOUND, INVALID_GRAPH, or AIRPORT_NOT_FOUND
      // as reported by findBestRoute itself.
      result.fallbackReason = (routeResult && routeResult.error) || "NO_ROUTE_FOUND";
      return result;
    }

    // ── Success: use the routed distance ──
    result.usedRouting = true;
    result.aerialKm = routeResult.totalDistanceKm;
    result.route = routeResult.route;
    result.layoverCount = routeResult.layoverCount;
    return result;
  } catch (e) {
    // Defensive catch-all — any unexpected error from the routing
    // pipeline falls back to plain Haversine rather than breaking
    // mapsAgent or the orchestrator.
    result.fallbackReason = "INVALID_GRAPH";
    return result;
  }
}

/* 
   AGENT 3: BUDGET AGENT
   ───────────────────────────────────────────────────────────
   COST FORMULA (step by step):

   CAR:
     totalDistKm   = roadDistanceKm × 2   (return trip)
     litresNeeded  = totalDistKm ÷ 15     (mileage)
     fuelCost      = litresNeeded × ₹102
     tollCost      = totalDistKm × ₹1.5
     transportCost = fuelCost + tollCost

   TRAIN:
     farePerPerson = roadDistanceKm × ₹1.2
     transportCost = farePerPerson × teamSize × 2 (return)

   FLIGHT (uses aerialDistanceKm — not road distance):
     1. Find the right pricing tier for this aerial distance:
          <500 km  → base ₹3,200 + ₹2.0/km over 0
          500-999  → base ₹5,500 + ₹2.5/km over 500
          1000-1999→ base ₹7,800 + ₹3.0/km over 1000
          ≥2000    → base ₹11,000 + ₹3.5/km over 2000
     2. Add ₹850 airport tax per ticket
     3. Apply ±10–22% variability using a deterministic seed
        derived from coordinate values → same route always
        gives the same "random-looking" price (deterministic)
     4. Multiply by persons × 2 (return tickets)

   HOTEL:
     hotelNights = numDays - 1
     hotelCost   = hotelNights × ₹1,200 × teamSize

   FOOD: numDays × ₹500 × teamSize
   MISC: numDays × ₹200 × teamSize
   TOTAL = transport + hotel + food + misc
    */
async function budgetAgent(routeData, teamSize, numDays, userBudget) {
  setAgent("budget", "running");

  // budgetAgent now receives the full routeData object so it can access
  // both aerial and road distances correctly per mode.
  var mode = routeData.mode;
  var distanceKm = routeData.distanceKm; // already the right distance for this mode

  addLog(
    "[ BUDGET ] Calculating: " +
      mode +
      ", " +
      distanceKm +
      " km (relevant distance), " +
      teamSize +
      " person(s), " +
      numDays +
      " day(s)...",
  );
  await sleep(300);

  var transportCost = 0;
  var transportBreakdown = "";
  var farePerTicket = 0; // used in log for flight

  if (mode === "car") {
    var totalDist = distanceKm * 2; // return trip
    var litres = totalDist / COSTS.carKmPerLitre;
    var fuelCost = Math.round(litres * COSTS.petrolPerLitre);
    var tollCost = Math.round(totalDist * COSTS.tollPerKm);
    transportCost = fuelCost + tollCost;
    transportBreakdown =
      "Fuel: ₹" +
      fuelCost.toLocaleString("en-IN") +
      " + Toll: ₹" +
      tollCost.toLocaleString("en-IN");
    addLog(
      "[ BUDGET ] Car: " +
        litres.toFixed(1) +
        "L × ₹" +
        COSTS.petrolPerLitre +
        " = ₹" +
        fuelCost.toLocaleString("en-IN") +
        " fuel + ₹" +
        tollCost.toLocaleString("en-IN") +
        " toll",
    );
  } else if (mode === "train") {
    var farePerPerson = Math.round(distanceKm * COSTS.trainSleeperPerKm);
    transportCost = farePerPerson * teamSize * 2;
    transportBreakdown =
      "₹" +
      farePerPerson.toLocaleString("en-IN") +
      "/person (Sleeper) × " +
      teamSize +
      " × 2 (return)";
    addLog(
      "[ BUDGET ] Train: ₹" +
        farePerPerson +
        "/person × " +
        teamSize +
        " × 2 = ₹" +
        transportCost.toLocaleString("en-IN"),
    );
  } else if (mode === "flight") {
    // ── 1. Find pricing tier ──
    var tier = COSTS.flightTiers[COSTS.flightTiers.length - 1]; // default: highest
    for (var t = 0; t < COSTS.flightTiers.length; t++) {
      if (
        distanceKm >= COSTS.flightTiers[t].min &&
        distanceKm <= COSTS.flightTiers[t].max
      ) {
        tier = COSTS.flightTiers[t];
        break;
      }
    }

    // ── 2. Base fare = tier base + marginal cost for km above tier threshold ──
    var kmAboveThreshold = Math.max(0, distanceKm - tier.min);
    var baseFare = tier.base + kmAboveThreshold * tier.marginal;

    // ── 3. Deterministic variability ──
    // Seed derived from the actual coordinates so the same route always
    // gives the same price (no random surprises on re-run).
    // Formula: fractional parts of coordinates multiplied together,
    // shifted into [flightVariabilityMin, flightVariabilityMax] range.
    var seed = computeFlightSeed(routeData.orgCoords, routeData.dstCoords);
    var variability =
      COSTS.flightVariabilityMin +
      seed * (COSTS.flightVariabilityMax - COSTS.flightVariabilityMin);

    // ── 4. Final per-ticket price ──
    farePerTicket = Math.round(
      baseFare * variability + COSTS.flightTaxPerTicket,
    );
    transportCost = farePerTicket * teamSize * 2; // both directions × all people

    transportBreakdown =
      "₹" +
      farePerTicket.toLocaleString("en-IN") +
      "/ticket (incl. tax) × " +
      teamSize +
      " × 2 (return)" +
      " | aerial: " +
      distanceKm +
      " km";

    addLog(
      "[ BUDGET ] Flight tier: ₹" +
        Math.round(tier.base) +
        " base + ₹" +
        Math.round(kmAboveThreshold * tier.marginal) +
        " marginal" +
        " × " +
        variability.toFixed(2) +
        " demand factor" +
        " + ₹" +
        COSTS.flightTaxPerTicket +
        " tax = ₹" +
        farePerTicket +
        "/ticket",
    );
  }

  var hotelNights = Math.max(numDays - 1, 0);
  var hotelCost = Math.round(
    hotelNights * COSTS.hotelPerNightPerson * teamSize,
  );
  var foodCost = Math.round(numDays * COSTS.foodPerDayPerson * teamSize);
  var miscCost = Math.round(numDays * COSTS.miscPerDayPerson * teamSize);
  var totalCost = transportCost + hotelCost + foodCost + miscCost;

  var isOverBudget = userBudget > 0 && totalCost > userBudget;
  var budgetPct =
    userBudget > 0 ? Math.round((totalCost / userBudget) * 100) : 0;
  var savings = userBudget > 0 ? Math.abs(userBudget - totalCost) : 0;

  setAgent("budget", "done");
  addLog(
    "[ BUDGET ] Transport: ₹" +
      transportCost.toLocaleString("en-IN") +
      " | Hotel: ₹" +
      hotelCost.toLocaleString("en-IN") +
      " | Food: ₹" +
      foodCost.toLocaleString("en-IN") +
      " | Misc: ₹" +
      miscCost.toLocaleString("en-IN"),
    isOverBudget ? "log-warn" : "log-ok",
  );
  addLog(
    "[ BUDGET ] ✓ TOTAL: ₹" + totalCost.toLocaleString("en-IN"),
    isOverBudget ? "log-warn" : "log-ok",
  );

  return {
    transportCost: transportCost,
    transportBreakdown: transportBreakdown,
    hotelCost: hotelCost,
    hotelNights: hotelNights,
    foodCost: foodCost,
    miscCost: miscCost,
    totalCost: totalCost,
    userBudget: userBudget,
    isOverBudget: isOverBudget,
    budgetPct: budgetPct,
    savings: savings,
    mode: mode,
  };
}

/* ──────────────────────────────────────────────────────────
   computeFlightSeed — Deterministic 0–1 value from coordinates.
   Using fractional parts of lat/lng values keeps the seed
   stable for the same city pair across sessions, while still
   producing meaningfully different values for different routes.
   ────────────────────────────────────────────────────────── */
function computeFlightSeed(orgCoords, dstCoords) {
  if (!orgCoords || !dstCoords) return 0.5; // neutral if coords missing

  // Extract fractional parts (always 0–1) and combine
  var frac = function (n) {
    return Math.abs(n) % 1;
  };
  var raw =
    (frac(orgCoords[0]) +
      frac(orgCoords[1]) +
      frac(dstCoords[0]) +
      frac(dstCoords[1])) /
    4;

  // Stretch through a simple non-linear curve so values aren't
  // clustered near 0.5 — gives better spread across the ±10–22% range
  return (Math.sin(raw * Math.PI * 7) + 1) / 2; // always 0–1
}

/* 
   AGENT 4: MISSION PLAN GENERATOR
    */
async function planGeneratorAgent(
  origin,
  destination,
  weatherDays,
  routeData,
  budgetData,
  startDate,
  endDate,
  teamSize,
  places,           /* NEW — array from placesAgent, may be [] */
) {
  setAgent("plan", "running");
  addLog("[ PLAN ] Building step-by-step mission plan...");
  await sleep(400);

  /* ── Distribute places across non-travel days ─────────────
     Day 0 (first) and last day are mostly travel days, so we
     assign places starting from day 1 (idx ≥ 1 up to last-1).
     We split the places list evenly across those middle days,
     preferring indoor venues on hazardous-weather days.
  ───────────────────────────────────────────────────────── */
  places = places || [];
  var days = getDaysBetween(startDate, endDate);
  var plan = [];

  /* Build per-day place pools — distribute evenly */
  var placePools = {};            // dayIndex → [place, ...]
  if (places.length > 0 && days.length > 0) {
    /* Middle days = not first, not last (or all if 1-2 day trip) */
    var middleIdxs = [];
    for (var mi = 0; mi < days.length; mi++) {
      /* Always include days except the very first (travel day) when trip > 1 day */
      if (days.length === 1 || mi > 0) middleIdxs.push(mi);
    }
    /* On hazardous days prefer indoor; sort places so indoor come first for those */
    var weatherMap = {};
    weatherDays.forEach(function(w) { weatherMap[w.date] = w; });

    var placesLeft = places.slice(); // copy
    var poolSize = Math.ceil(placesLeft.length / (middleIdxs.length || 1));

    middleIdxs.forEach(function(dayIdx, pIdx) {
      var dayDate = days[dayIdx];
      var wx = weatherMap[dayDate];
      var isHaz = wx && wx.isHazardous;
      /* On hazardous days, prefer indoor places */
      if (isHaz) {
        placesLeft.sort(function(a, b) {
          return (b.isIndoor ? 1 : 0) - (a.isIndoor ? 1 : 0);
        });
      }
      var chunk = placesLeft.splice(0, Math.min(poolSize, 4)); // max 4 places/day
      chunk.forEach(function(p) { p.dayAssigned = dayIdx + 1; });
      if (chunk.length > 0) placePools[dayIdx] = chunk;
    });
  }

  var departurePoint =
    routeData.mode === "flight"
      ? origin + " Airport"
      : routeData.mode === "train"
        ? origin + " Railway Station"
        : origin;
  var arrivalPoint =
    routeData.mode === "flight"
      ? destination + " Airport"
      : routeData.mode === "train"
        ? destination + " Railway Station"
        : destination;

  days.forEach(function (dateStr, idx) {
    var isFirst = idx === 0;
    var isLast = idx === days.length - 1;
    var dayNum = idx + 1;
    var weather = null;
    for (var w = 0; w < weatherDays.length; w++) {
      if (weatherDays[w].date === dateStr) {
        weather = weatherDays[w];
        break;
      }
    }
    var tasks = [];
    var label = formatDateLabel(dateStr);

    if (isFirst) {
      tasks.push({
        time: "05:30",
        text: "Team assembly. Final briefing, equipment and document check.",
        type: "",
      });
      if (routeData.mode === "car") {
        tasks.push({
          time: "06:00",
          text:
            "Depart " +
            origin +
            " by car. Road distance: " +
            routeData.distanceKm +
            " km.",
          type: "",
        });
        var midHr = 6 + routeData.drivingTimeHrs / 2;
        tasks.push({
          time: formatHrMin(midHr),
          text:
            "Mid-route stop — refuel, food. ~" +
            Math.round(routeData.distanceKm / 2) +
            " km from origin.",
          type: "",
        });
        tasks.push({
          time: formatHrMin(6 + routeData.travelTimeHrs),
          text:
            "Arrive " +
            destination +
            ". Drive: " +
            routeData.travelTimeHrs +
            " hrs.",
          type: "",
        });
      } else if (routeData.mode === "train") {
        tasks.push({
          time: "06:00",
          text: "Depart for " + departurePoint + ".",
          type: "",
        });
        tasks.push({
          time: "07:30",
          text:
            "Train departs. Journey: " +
            routeData.travelTimeHrs +
            " hrs (" +
            routeData.distanceKm +
            " km at 60 km/h avg).",
          type: "",
        });
        tasks.push({
          time: formatHrMin(7.5 + routeData.travelTimeHrs - 2),
          text: "Arrive " + arrivalPoint + ". Transfer to hotel.",
          type: "",
        });
      } else {
        tasks.push({
          time: "05:00",
          text: "Depart for " + departurePoint + ". Reach 2 hrs before flight.",
          type: "",
        });
        tasks.push({
          time: "07:00",
          text:
            "Flight departs. Airtime: " +
            Math.round((routeData.distanceKm / SPEED.flight) * 60) +
            " min.",
          type: "",
        });
        tasks.push({
          time: formatHrMin(7 + routeData.distanceKm / SPEED.flight + 1),
          text: "Arrive " + arrivalPoint + ". Baggage, transfer to hotel.",
          type: "",
        });
      }
      if (weather && weather.isHazardous) {
        tasks.push({
          time: "—",
          text:
            "⚠ WEATHER WARNING: " +
            weather.description +
            ", wind " +
            weather.windSpeed +
            " m/s. Travel may be delayed.",
          type: "danger",
        });
      }
      tasks.push({
        time: "14:00",
        text: "Check into hotel. Rest and acclimatise.",
        type: "",
      });
      tasks.push({
        time: "16:00",
        text: "Initial area recce. Identify key zones and safe observation points.",
        type: "",
      });
      tasks.push({
        time: "19:00",
        text: "Dinner + debrief. Confirm Day 2 objective list.",
        type: "",
      });
    } else if (isLast) {
      tasks.push({
        time: "07:00",
        text: "Final sweep. Collect all documentation and evidence.",
        type: "",
      });
      tasks.push({
        time: "09:00",
        text:
          "Check out. Hotel cost settled: ₹" +
          budgetData.hotelCost.toLocaleString("en-IN") +
          " total.",
        type: "",
      });
      if (weather && weather.isHazardous) {
        tasks.push({
          time: "09:30",
          text:
            "⚠ WEATHER RISK today: " +
            weather.description +
            ". Add buffer time.",
          type: "warn",
        });
      }
      if (routeData.mode === "car") {
        tasks.push({
          time: "10:00",
          text: "Depart " + destination + ". Return drive to " + origin + ".",
          type: "",
        });
        tasks.push({
          time: formatHrMin(10 + routeData.travelTimeHrs),
          text: "Arrive " + origin + ". Mission complete.",
          type: "",
        });
      } else if (routeData.mode === "train") {
        tasks.push({
          time: "09:30",
          text: "Head to " + arrivalPoint + ". Board return train.",
          type: "",
        });
        tasks.push({
          time: formatHrMin(10.5 + routeData.travelTimeHrs - 2),
          text: "Arrive " + departurePoint + ". Mission complete.",
          type: "",
        });
      } else {
        tasks.push({
          time: "10:00",
          text: "Head to " + arrivalPoint + ". Check-in 2 hrs early.",
          type: "",
        });
        tasks.push({
          time: formatHrMin(12 + routeData.distanceKm / SPEED.flight + 1),
          text: "Arrive " + departurePoint + ". Mission complete.",
          type: "",
        });
      }
      tasks.push({
        time: "—",
        text:
          "Upload all findings to HQ. Total mission cost: ₹" +
          budgetData.totalCost.toLocaleString("en-IN") +
          ".",
        type: "",
      });
    } else {
      tasks.push({
        time: "07:30",
        text: "Morning briefing. Review intel from Day " + (dayNum - 1) + ".",
        type: "",
      });
      if (weather && weather.isHazardous) {
        tasks.push({
          time: "08:00",
          text:
            "⚠ HAZARDOUS CONDITIONS: " +
            weather.description +
            ". Use indoor observation only.",
          type: "danger",
        });
      }
      tasks.push({
        time: "08:30",
        text:
          "Breakfast + equipment check. Budget: ₹" +
          COSTS.foodPerDayPerson * teamSize +
          " food today.",
        type: "",
      });

      /* ── Inject place visits if we have them for this day ── */
      var dayPlaces = placePools[idx] || [];
      if (dayPlaces.length > 0) {
        /* Slot times: morning → afternoon → evening */
        var timeSlots = { "Morning": "09:00", "Afternoon": "13:00", "Evening": "17:30", "Anytime": "11:00" };
        var grouped = { Morning: [], Afternoon: [], Evening: [], Anytime: [] };
        dayPlaces.forEach(function(p) { (grouped[p.bestTime] || grouped.Anytime).push(p); });

        Object.keys(grouped).forEach(function(slot) {
          grouped[slot].forEach(function(p) {
            var tag = p.isIndoor ? "[INDOOR]" : "[OUTDOOR]";
            if (weather && weather.isHazardous && !p.isIndoor) {
              tasks.push({
                time: timeSlots[slot] || "10:00",
                text: "⚠ " + p.emoji + " " + p.name + " (OUTDOOR — check conditions before visiting)",
                type: "warn",
              });
            } else {
              tasks.push({
                time: timeSlots[slot] || "10:00",
                text: p.emoji + " Visit: " + p.name + " " + tag + " — " + p.category,
                type: "",
              });
            }
          });
        });

        tasks.push({
          time: "12:00",
          text: "Midday break. Lunch. Secure equipment.",
          type: "",
        });
        tasks.push({
          time: "19:00",
          text: "Day " + dayNum + " debrief. Compile intel. Transmit to HQ.",
          type: "",
        });
      } else {
        /* No places — keep original generic tasks */
        tasks.push({
          time: "09:00",
          text: "Field operations. Zone 1 — document all movement and activity.",
          type: "",
        });
        tasks.push({
          time: "12:00",
          text: "Midday break. Secure equipment. Rest.",
          type: "",
        });
        tasks.push({
          time: "13:30",
          text: "Zone 2 operations. Photography, measurements, contact tracking.",
          type: "",
        });
        tasks.push({
          time: "17:00",
          text: "Return to base. Secure all data. Equipment maintenance.",
          type: "",
        });
        tasks.push({
          time: "19:00",
          text: "Day " + dayNum + " debrief. Compile report. Transmit to HQ.",
          type: "",
        });
      }
    }

    var dotColor =
      weather && weather.isHazardous ? "red" : isFirst || isLast ? "amber" : "";
    plan.push({
      dayNum: dayNum,
      dateStr: dateStr,
      label: label,
      tasks: tasks,
      weather: weather,
      dotColor: dotColor,
    });
  });

  setAgent("plan", "done");
  addLog("[ PLAN ] ✓ Plan complete: " + plan.length + " day(s).", "log-ok");
  return plan;
}


/* ============================================================
   AGENT 5: PLACES AGENT
   ────────────────────────────────────────────────────────────
   Uses OpenTripMap API (free, no key needed for basic use).
   Endpoint: https://api.opentripmap.com/0.1/en/places/...

   Flow:
     1. Geocode city → lat/lng via OpenTripMap geoname search
     2. For each selected interest → map to OTM kinds category
     3. Fetch up to 15 places per category within 20km radius
     4. Deduplicate by name, sort by rating desc
     5. Return flat array of structured place objects

   Fallback: if API fails or returns nothing → use curated
   mock data so the plan still generates with place tasks.
   ============================================================ */

/* Interest → OpenTripMap "kinds" category mapping */
var INTEREST_TO_KINDS = {
  historical: "historic,fortifications,monuments_and_memorials",
  museum:     "museums",
  art:        "art_galleries",
  music:      "music",
  adventure:  "amusements,sport,outdoor_activities",
  zoo:        "zoos_and_aquariums",
  food:       "foods,restaurants,cafes",
  shopping:   "shops,markets",
  mall:       "malls",
  movies:     "cinemas",
  hotel:      "tourist_facilities,hotels",
};

/* Whether a category is considered indoor (for weather matching) */
var INDOOR_KINDS = {
  museum: true, art: true, music: true, mall: true,
  movies: true, hotel: true, shopping: true,
};

/* Best visit time per interest */
var BEST_TIME = {
  historical: "Morning",  museum:   "Morning",  art:      "Morning",
  music:      "Evening",  adventure:"Afternoon", zoo:      "Morning",
  food:       "Evening",  shopping: "Afternoon", mall:     "Afternoon",
  movies:     "Evening",  hotel:    "Anytime",
};

/* Emoji per interest */
var INTEREST_EMOJI = {
  historical:"🏛", museum:"🖼", art:"🎨", music:"🎵",
  adventure:"🧗",  zoo:"🦁",   food:"🍛", shopping:"🛍",
  mall:"🏬",       movies:"🎬", hotel:"🏨",
};

/* OpenTripMap free API key — public demo key, rate-limited but works */
var OTM_API_KEY = "5ae2e3f221c38a28845f05b6898dc461bc98a83e6bdb9f7e9ee83017";

async function placesAgent(city, interests) {
  setAgent("places", "running");
  addLog("[ PLACES ] Fetching attractions for: " + city + " (" + interests.join(", ") + ")...");

  if (!interests || interests.length === 0) {
    setAgent("places", "done");
    addLog("[ PLACES ] No interests selected — skipping.", "log-warn");
    return [];
  }

  try {
    /* ── Step 1: Geocode city via OTM ── */
    var geoUrl = "https://api.opentripmap.com/0.1/en/places/geoname"
      + "?name=" + encodeURIComponent(city)
      + "&apikey=" + OTM_API_KEY;
    var geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("OTM geocode HTTP " + geoRes.status);
    var geoData = await geoRes.json();
    if (!geoData.lat) throw new Error("City not found in OTM: " + city);

    var lat = geoData.lat;
    var lon = geoData.lon;
    addLog("[ PLACES ] City located: " + lat.toFixed(3) + ", " + lon.toFixed(3));

    /* ── Step 2: Fetch places per interest ── */
    var allPlaces = [];
    var seenNames = {};

    for (var i = 0; i < interests.length; i++) {
      var interest = interests[i];
      var kinds    = INTEREST_TO_KINDS[interest] || interest;

      try {
        var placesUrl = "https://api.opentripmap.com/0.1/en/places/radius"
          + "?radius=20000"                       // 20 km radius
          + "&lon=" + lon
          + "&lat=" + lat
          + "&kinds=" + encodeURIComponent(kinds)
          + "&limit=15"
          + "&rate=2"                             // minimum rating filter (0-3 scale)
          + "&format=json"
          + "&apikey=" + OTM_API_KEY;

        var placesRes = await fetch(placesUrl);
        if (!placesRes.ok) continue;
        var placesData = await placesRes.json();

        if (!Array.isArray(placesData) || placesData.length === 0) continue;

        placesData.forEach(function(p) {
          if (!p.name || p.name.trim() === "") return;  // skip unnamed
          var nameKey = p.name.trim().toLowerCase();
          if (seenNames[nameKey]) return;               // deduplicate
          seenNames[nameKey] = true;

          allPlaces.push({
            name:     p.name.trim(),
            category: interest,
            rating:   p.rate || 0,           // OTM rate: 0–3
            address:  p.address || city,
            isIndoor: !!INDOOR_KINDS[interest],
            bestTime: BEST_TIME[interest] || "Anytime",
            emoji:    INTEREST_EMOJI[interest] || "📍",
            dayAssigned: null,               // filled by planner
          });
        });

        addLog("[ PLACES ] " + interest + ": " + placesData.length + " found.");
      } catch (innerErr) {
        addLog("[ PLACES ] " + interest + " fetch failed — skipping.", "log-warn");
      }
    }

    /* ── Step 3: Sort by rating desc, cap at 30 total ── */
    allPlaces.sort(function(a, b) { return b.rating - a.rating; });
    allPlaces = allPlaces.slice(0, 30);

    if (allPlaces.length === 0) {
      addLog("[ PLACES ] No results from API — using curated fallback.", "log-warn");
      allPlaces = buildMockPlaces(city, interests);
    }

    setAgent("places", "done");
    addLog("[ PLACES ] ✓ " + allPlaces.length + " place(s) ready.", "log-ok");
    return allPlaces;

  } catch (e) {
    setAgent("places", "error");
    addLog("[ PLACES ] ERROR: " + e.message + " — using curated fallback.", "log-error");
    return buildMockPlaces(city, interests);
  }
}

/* ──────────────────────────────────────────────────────────
   buildMockPlaces — Curated fallback so the feature always
   works even when the API is unreachable or rate-limited.
   ────────────────────────────────────────────────────────── */
function buildMockPlaces(city, interests) {
  var MOCK = {
    historical: [
      { name: city + " Fort",           bestTime: "Morning",   isIndoor: false },
      { name: city + " Palace",         bestTime: "Morning",   isIndoor: false },
      { name: "Old " + city + " City",  bestTime: "Afternoon", isIndoor: false },
    ],
    museum: [
      { name: city + " State Museum",   bestTime: "Morning",   isIndoor: true },
      { name: city + " Heritage Museum",bestTime: "Morning",   isIndoor: true },
    ],
    art: [
      { name: city + " Art Gallery",    bestTime: "Morning",   isIndoor: true },
      { name: "Modern Art Centre",      bestTime: "Afternoon", isIndoor: true },
    ],
    music: [
      { name: city + " Music Academy",  bestTime: "Evening",   isIndoor: true },
      { name: "Live Music Lounge",      bestTime: "Evening",   isIndoor: true },
    ],
    adventure: [
      { name: city + " Adventure Park", bestTime: "Afternoon", isIndoor: false },
      { name: "Outdoor Trekking Trail", bestTime: "Morning",   isIndoor: false },
    ],
    zoo: [
      { name: city + " Zoological Park",bestTime: "Morning",   isIndoor: false },
    ],
    food: [
      { name: city + " Food Street",    bestTime: "Evening",   isIndoor: false },
      { name: "Local Dhaba Row",        bestTime: "Evening",   isIndoor: false },
      { name: "Heritage Restaurant",    bestTime: "Afternoon", isIndoor: true  },
    ],
    shopping: [
      { name: city + " Bazaar",         bestTime: "Afternoon", isIndoor: false },
      { name: "Handicraft Market",      bestTime: "Afternoon", isIndoor: false },
    ],
    mall: [
      { name: city + " Mall",           bestTime: "Afternoon", isIndoor: true  },
    ],
    movies: [
      { name: "PVR " + city,            bestTime: "Evening",   isIndoor: true  },
    ],
    hotel: [
      { name: city + " Heritage Hotel", bestTime: "Anytime",   isIndoor: true  },
    ],
  };

  var result = [];
  var seenNames = {};
  interests.forEach(function(interest) {
    var mocks = MOCK[interest] || [];
    mocks.forEach(function(m) {
      if (seenNames[m.name]) return;
      seenNames[m.name] = true;
      result.push({
        name:       m.name,
        category:   interest,
        rating:     (Math.random() * 1 + 2).toFixed(1),
        address:    city,
        isIndoor:   m.isIndoor,
        bestTime:   m.bestTime,
        emoji:      INTEREST_EMOJI[interest] || "📍",
        dayAssigned: null,
      });
    });
  });

  return result;
}