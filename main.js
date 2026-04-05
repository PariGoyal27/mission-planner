/* 
   BOOT SCREEN
    */
const BOOT_MESSAGES = [
  "[ OK ] Loading tactical kernel...",
  "[ OK ] Mounting encrypted filesystem...",
  "[ OK ] Initializing Weather Agent...",
  "[ OK ] Initializing Maps Agent...",
  "[ OK ] Initializing Budget Calculator...",
  "[ OK ] Initializing Plan Generator...",
  "[ OK ] Command Center UI: READY",
  "[ ** ] ALL SYSTEMS OPERATIONAL — MISSION READY",
];

window.addEventListener("DOMContentLoaded", () => {
  runBootSequence();
  startClock();
  setDefaultDates();
});

function runBootSequence() {
  const linesEl  = document.getElementById("boot-lines");
  const barEl    = document.getElementById("boot-bar");
  const statusEl = document.getElementById("boot-status");
  let i = 0;

  const iv = setInterval(() => {
    if (i >= BOOT_MESSAGES.length) {
      clearInterval(iv);
      statusEl.textContent = "BOOT COMPLETE — ENTERING COMMAND CENTER";
      setTimeout(() => {
        const boot = document.getElementById("boot-screen");
        boot.style.opacity = "0";
        setTimeout(() => {
          boot.style.display = "none";
          document.getElementById("app").classList.remove("hidden");
        }, 500);
      }, 600);
      return;
    }
    const line = document.createElement("div");
    line.textContent = BOOT_MESSAGES[i];
    if (BOOT_MESSAGES[i].includes("**")) line.style.color = "#00ff87";
    linesEl.appendChild(line);
    linesEl.scrollTop = linesEl.scrollHeight;
    const pct = Math.round(((i + 1) / BOOT_MESSAGES.length) * 100);
    barEl.style.width = pct + "%";
    statusEl.textContent = `LOADING... ${pct}%`;
    i++;
  }, 180);
}

function startClock() {
  const el = document.getElementById("live-clock");
  const upd = () => {
    const n = new Date();
    el.textContent = n.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
      + " | " + n.toLocaleTimeString("en-IN", { hour12: false });
  };
  upd(); setInterval(upd, 1000);
}

function setDefaultDates() {
  const t  = new Date();
  const d1 = new Date(t); d1.setDate(t.getDate() + 1);
  const d2 = new Date(t); d2.setDate(t.getDate() + 3);
  document.getElementById("start-date").value = toInputDate(d1);
  document.getElementById("end-date").value   = toInputDate(d2);
}

function toInputDate(d) { return d.toISOString().split("T")[0]; }


/* 
   LOG + AGENT STATUS
    */
function addLog(msg, type) {
  type = type || "";
  const log  = document.getElementById("mission-log");
  const line = document.createElement("div");
  line.className = "log-line " + type;
  const t = new Date().toLocaleTimeString("en-IN", { hour12: false });
  line.textContent = "[" + t + "] " + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function setAgent(id, status) {
  const row = document.getElementById("agent-" + id);
  if (!row) return;
  row.querySelector(".agent-dot").className    = "agent-dot dot-" + status;
  row.querySelector(".agent-state").textContent = status.toUpperCase();
}


/* 
   INPUT VALIDATION
    */
function validateInputs() {
  var origin  = document.getElementById("origin").value.trim();
  var dest    = document.getElementById("destination").value.trim();
  var start   = document.getElementById("start-date").value;
  var end     = document.getElementById("end-date").value;
  var budget  = parseFloat(document.getElementById("budget").value);
  var errors  = [];

  if (!origin)  errors.push("Origin point is required.");
  if (!dest)    errors.push("Target city is required.");
  if (!start)   errors.push("Departure date is required.");
  if (!end)     errors.push("Return date is required.");
  if (start && end && end < start)
    errors.push("Return date must be same as or after departure date.");
  if (budget && budget < 500)
    errors.push("Budget too low. Minimum ₹500.");
  return errors;
}



/* 
   showApiError — Displays a prominent error in the output panel
   so the user always knows exactly what went wrong, rather than
   silently seeing wrong data.
    */
function showApiError(agentName, message) {
  // Show placeholder so output area doesn't appear empty
  document.getElementById("placeholder").classList.remove("hidden");

  // Inject a visible error card into the output panel
  var existing = document.getElementById("api-error-card");
  if (!existing) {
    var card = document.createElement("div");
    card.id = "api-error-card";
    card.style.cssText =
      "margin:20px;padding:16px 20px;border:1px solid var(--red-dim);"
      + "background:rgba(255,60,60,0.06);font-family:var(--mono);font-size:12px;"
      + "color:var(--red);line-height:1.8;animation:slideUp 0.3s ease;";
    document.querySelector(".panel-output").appendChild(card);
    existing = card;
  }

  existing.innerHTML =
    "<div style='font-family:var(--head);font-size:15px;font-weight:700;letter-spacing:3px;margin-bottom:8px'>"
    + "⊗ " + agentName.toUpperCase() + " FAILURE</div>"
    + "<div>" + message + "</div>"
    + "<div style='margin-top:10px;color:var(--text-dim);font-size:10px;letter-spacing:1px'>"
    + "Fix the issue above and click INITIATE MISSION again.</div>";
}

/* 
   clearApiError — Remove the error card when a new mission starts
   */
function clearApiError() {
  var card = document.getElementById("api-error-card");
  if (card) card.remove();
}



/* 
   EDGE-CASE DETECTOR
    */
function detectEdgeCases(weatherDays, budgetData, routeData, numDays) {
  var alerts = [];

  var hazDays = weatherDays.filter(function(w) { return w.isHazardous; });
  if (hazDays.length > 0) {
    var dates = hazDays.map(function(d) { return formatDateLabel(d.date); }).join(", ");
    alerts.push({
      type: "danger",
      msg: "⛈  SEVERE WEATHER on " + dates + ": " + hazDays[0].description
        + ". Wind " + hazDays[0].windSpeed + " m/s. Avoid open surveillance. Consider rescheduling.",
    });
  }

  if (budgetData.isOverBudget) {
    var over = (budgetData.totalCost - budgetData.userBudget).toLocaleString("en-IN");
    var tip  = budgetData.mode === "flight" ? "Tip: Switch to train to save ₹10,000+ on transport."
             : budgetData.mode === "car"    ? "Tip: Reduce team size or take train to cut costs."
             : "Tip: Use government guesthouse or reduce team size.";
    alerts.push({
      type: "warn",
      msg: "💸  BUDGET OVERRUN by ₹" + over + ". Estimated ₹"
        + budgetData.totalCost.toLocaleString("en-IN")
        + " vs approved ₹" + budgetData.userBudget.toLocaleString("en-IN") + ". " + tip,
    });
  }

  if (routeData.travelTimeHrs > 10 && routeData.mode === "car") {
    alerts.push({
      type: "warn",
      msg: "🛣  LONG DRIVE: " + routeData.travelTimeHrs + " hrs. Driver fatigue risk HIGH."
        + " Plan an overnight stop or switch to train/flight.",
    });
  }

  if (numDays === 1) {
    alerts.push({
      type: "warn",
      msg: "⏱  SINGLE-DAY OPERATION: Very short window. Ensure travel + surveillance fits daylight hours.",
    });
  }

  if (routeData.distanceKm < 300 && routeData.mode === "flight") {
    alerts.push({
      type: "warn",
      msg: "✈  SHORT DISTANCE FLIGHT (" + routeData.distanceKm + " km): Car or train would be faster and ₹5,000+ cheaper for this distance.",
    });
  }

  return alerts;
}



/* 
   ORCHESTRATOR
    */
async function launchMission() {
  var errors = validateInputs();
  var errBox = document.getElementById("error-box");
  if (errors.length > 0) {
    errBox.innerHTML = errors.map(function(e) { return "• " + e; }).join("<br>");
    errBox.classList.remove("hidden");
    return;
  }
  errBox.classList.add("hidden");

  var origin    = document.getElementById("origin").value.trim();
  var dest      = document.getElementById("destination").value.trim();
  var startDate = document.getElementById("start-date").value;
  var endDate   = document.getElementById("end-date").value;
  var mode      = document.querySelector("input[name='transport']:checked").value;
  var budget    = parseFloat(document.getElementById("budget").value) || 0;
  var teamSize  = parseInt(document.getElementById("team-size").value) || 1;
  var numDays   = getDaysBetween(startDate, endDate).length;

  /* ── Collect selected interests ── */
  var interests = Array.from(
    document.querySelectorAll("input[name='interest']:checked")
  ).map(function(cb) { return cb.value; });

  var btn = document.getElementById("launch-btn");
  btn.disabled = true;
  document.getElementById("btn-text").classList.add("hidden");
  document.getElementById("btn-loader").classList.remove("hidden");
  document.getElementById("placeholder").classList.add("hidden");
  document.getElementById("output-sections").classList.add("hidden");
  clearApiError();
  ["weather","maps","budget","places","plan"].forEach(function(a) { setAgent(a, "idle"); });

  addLog("[ SYS ] ══ MISSION INITIATED ══");
  addLog("[ SYS ] " + origin + " → " + dest + " | " + mode.toUpperCase() + " | " + numDays + " day(s) | " + teamSize + " operative(s)");
  if (budget > 0)         addLog("[ SYS ] Budget: ₹" + budget.toLocaleString("en-IN"));
  if (interests.length)   addLog("[ SYS ] Interests: " + interests.join(", "));

  try {
    /* Weather + Maps run in parallel */
    addLog("[ SYS ] Deploying Weather + Maps agents in parallel...");
    var results = await Promise.all([
      weatherAgent(dest, startDate, endDate),
      mapsAgent(origin, dest, mode),
    ]);
    var weatherDays = results[0];
    var routeData   = results[1];

    var budgetData  = await budgetAgent(routeData, teamSize, numDays, budget);

    /* ── Places agent — runs after budget, non-blocking ── */
    var placesData  = await placesAgent(dest, interests);

    var missionPlan = await planGeneratorAgent(
      origin, dest, weatherDays, routeData, budgetData,
      startDate, endDate, teamSize, placesData
    );
    var alerts = detectEdgeCases(weatherDays, budgetData, routeData, numDays);

    renderAll(weatherDays, routeData, budgetData, missionPlan, alerts,
              placesData, interests,
              origin, dest, numDays, teamSize, startDate, endDate);
    addLog("[ SYS ] ══ ALL COMPLETE — MISSION PLAN READY ══", "log-ok");

  } catch (err) {
    // Error is already logged and displayed by the agent that threw.
    // Here we just ensure the button resets and placeholder shows.
    addLog("[ SYS ] MISSION ABORTED: " + err.message, "log-error");
    console.error(err);
    document.getElementById("placeholder").classList.remove("hidden");
  }

  btn.disabled = false;
  document.getElementById("btn-text").classList.remove("hidden");
  document.getElementById("btn-loader").classList.add("hidden");
}



/* 
   RENDER FUNCTIONS
   */
var _weatherGlobal = [];

function renderAll(weatherDays, routeData, budgetData, missionPlan, alerts, placesData, interests, origin, dest, numDays, teamSize, startDate, endDate) {
  _weatherGlobal = weatherDays;
  document.getElementById("output-sections").classList.remove("hidden");
  renderStatBar(routeData, numDays, budgetData, weatherDays);
  renderWeatherCard(weatherDays);
  renderRouteCard(routeData);
  renderBudgetCard(budgetData);
  renderAlerts(alerts);
  renderPlacesCard(placesData, interests);   /* NEW */
  renderSummaryCard(weatherDays, routeData, budgetData, origin, dest, numDays, teamSize, startDate, endDate);
  renderMissionPlan(missionPlan);
}

function renderStatBar(routeData, numDays, budgetData, weatherDays) {
  var hazAny = weatherDays.some(function(w) { return w.isHazardous; });
  var threat = (budgetData.isOverBudget && hazAny) ? "CRITICAL"
             : (budgetData.isOverBudget || routeData.travelTimeHrs > 10) ? "MODERATE"
             : "LOW";

  document.getElementById("stat-distance").textContent = routeData.distanceKm + " km";
  document.getElementById("stat-time").textContent     = routeData.travelTimeHrs + " hrs";
  document.getElementById("stat-days").textContent     = numDays;
  document.getElementById("stat-cost").textContent     = "₹" + budgetData.totalCost.toLocaleString("en-IN");

  var el = document.getElementById("stat-threat");
  el.textContent = threat;
  el.style.color = threat === "CRITICAL" ? "var(--red)" : threat === "MODERATE" ? "var(--amber)" : "var(--green)";
}

function renderWeatherCard(weatherDays) {
  var badge = document.getElementById("weather-badge");
  var haz   = weatherDays.filter(function(w) { return w.isHazardous; }).length;
  if (haz > 0) {
    badge.textContent = haz + " RISK DAY(S)";
    badge.style.cssText = "border-color:var(--red-dim);color:var(--red);background:rgba(255,60,60,0.06)";
  } else {
    badge.textContent = "ALL CLEAR";
  }

  var html = "<div class='weather-grid'>";
  weatherDays.forEach(function(day) {
    html += "<div class='weather-day'>"
      + "<div class='weather-date'>" + formatDateLabel(day.date)
      + (day.isEstimate ? " <span style='color:var(--amber-dim);font-size:9px'>(EST)</span>" : "")
      + "</div>"
      + "<div class='weather-icon-text'>" + day.emoji + "</div>"
      + "<div class='weather-desc'>" + day.description + "</div>"
      + "<div class='weather-temp'>" + day.temp + "°C</div>"
      + "<div style='font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-top:3px'>"
      + "💨 " + day.windSpeed + " m/s &nbsp;|&nbsp; 💧 " + day.humidity + "%</div>"
      + (day.isHazardous ? "<div class='weather-warn'>⚠ HAZARDOUS CONDITIONS</div>" : "")
      + "</div>";
  });
  html += "</div>";
  document.getElementById("weather-body").innerHTML = html;
}

function renderRouteCard(r) {
  var modeLabel = r.mode === "car" ? " CAR / ROAD" : r.mode === "train" ? "🚆 TRAIN" : "✈ FLIGHT";

  // For flight: show aerial (Haversine) as the primary distance,
  // plus road distance as reference. For car/train: road distance only.
  var distanceRow, returnRow, timeNote;
  if (r.mode === "flight") {
    distanceRow = row("AERIAL DISTANCE", r.aerialDistanceKm + " km (Haversine)");
    returnRow   = row("AERIAL RETURN", (r.aerialDistanceKm * 2) + " km total");
    timeNote    = "incl. 3hr airport buffer";
  } else if (r.mode === "train") {
    distanceRow = row("ROAD DISTANCE", r.distanceKm + " km (one way)");
    returnRow   = row("RETURN DISTANCE", (r.distanceKm * 2) + " km total");
    timeNote    = "incl. 2hr station buffer";
  } else {
    distanceRow = row("ROAD DISTANCE", r.distanceKm + " km (one way)");
    returnRow   = row("RETURN DISTANCE", (r.distanceKm * 2) + " km total");
    timeNote    = "live ORS road data";
  }

  document.getElementById("route-body").innerHTML =
    row("FROM", r.origin.toUpperCase())
    + row("TO", r.destination.toUpperCase())
    + row("MODE", modeLabel)
    + distanceRow
    + returnRow
    + row("TRAVEL TIME (" + r.mode.toUpperCase() + ")",
        r.travelTimeHrs + " hrs <span style='font-size:9px;color:var(--text-dim)'>" + timeNote + "</span>")
    + (r.mode === "flight" && r.roadDistanceKm
        ? row("ROAD DIST (ref)", r.roadDistanceKm + " km by road") : "")
    + (r.mode === "train"
        ? row("DRIVING TIME (ref)", r.drivingTimeHrs + " hrs by road") : "");
}

function row(k, v) {
  return "<div class='route-row'><span class='route-key'>" + k + "</span><span class='route-val'>" + v + "</span></div>";
}

function renderBudgetCard(b) {
  var badge = document.getElementById("budget-badge");
  if (b.isOverBudget) {
    badge.textContent = "OVER BUDGET";
    badge.style.cssText = "border-color:var(--red-dim);color:var(--red);background:rgba(255,60,60,0.06)";
  } else if (b.userBudget > 0) {
    badge.textContent = b.budgetPct + "% USED";
  }

  var barFill  = b.userBudget > 0 ? Math.min(b.budgetPct, 100) : 0;
  var overClass= b.isOverBudget ? "budget-over" : "";
  var barClass = b.isOverBudget ? "over" : "";

  document.getElementById("budget-body").innerHTML =
    "<div class='budget-line'><span class='budget-key'>TRANSPORT (" + b.mode.toUpperCase() + ")</span>"
    + "<span class='budget-val'>₹" + b.transportCost.toLocaleString("en-IN") + "</span></div>"
    + "<div class='budget-line' style='padding-left:10px'>"
    + "<span class='budget-key' style='font-size:9px;color:var(--text-dim)'>" + b.transportBreakdown + "</span></div>"
    + "<div class='budget-line'><span class='budget-key'>HOTEL (" + b.hotelNights + " night" + (b.hotelNights !== 1 ? "s" : "") + ")</span>"
    + "<span class='budget-val'>₹" + b.hotelCost.toLocaleString("en-IN") + "</span></div>"
    + "<div class='budget-line'><span class='budget-key'>FOOD</span><span class='budget-val'>₹" + b.foodCost.toLocaleString("en-IN") + "</span></div>"
    + "<div class='budget-line'><span class='budget-key'>MISC / OPS</span><span class='budget-val'>₹" + b.miscCost.toLocaleString("en-IN") + "</span></div>"
    + "<div class='budget-line' style='margin-top:4px;border-top:1px solid var(--border2)'>"
    + "<span class='budget-key' style='font-weight:bold'>GRAND TOTAL</span>"
    + "<span class='budget-val budget-total " + overClass + "'>₹" + b.totalCost.toLocaleString("en-IN") + "</span></div>"
    + (b.userBudget > 0
      ? "<div class='budget-bar-wrap'><div class='budget-bar-fill " + barClass + "' style='width:" + barFill + "%'></div></div>"
        + "<div class='budget-pct'>Approved: ₹" + b.userBudget.toLocaleString("en-IN") + " &nbsp;|&nbsp; "
        + (b.isOverBudget
          ? "<span style='color:var(--red)'>Overrun by ₹" + b.savings.toLocaleString("en-IN") + "</span>"
          : "<span style='color:var(--green)'>Remaining: ₹" + b.savings.toLocaleString("en-IN") + "</span>")
        + "</div>"
      : "");
}

function renderAlerts(alerts) {
  var box = document.getElementById("alert-box");
  if (!alerts.length) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  var hasDanger = alerts.some(function(a) { return a.type === "danger"; });
  box.className = "alert-box " + (hasDanger ? "danger" : "");
  box.innerHTML = "<div style='font-family:var(--head);font-size:14px;font-weight:700;letter-spacing:3px;margin-bottom:10px'>⚠ MISSION ALERTS (" + alerts.length + ")</div>"
    + alerts.map(function(a) {
        return "<div style='margin-bottom:8px;padding:8px 10px;border-left:2px solid currentColor;background:rgba(0,0,0,0.2);font-size:11px;line-height:1.7'>" + a.msg + "</div>";
      }).join("");
}

function renderSummaryCard(weatherDays, routeData, budgetData, origin, dest, numDays, teamSize, startDate, endDate) {
  var haz     = weatherDays.filter(function(w) { return w.isHazardous; }).length;
  var avgTemp = weatherDays.length ? Math.round(avgArr(weatherDays.map(function(w) { return w.temp; }))) : "N/A";
  var status  = budgetData.isOverBudget ? "OVER BUDGET" : haz > 0 ? "WEATHER RISK" : "GO — APPROVED";
  var stCls   = budgetData.isOverBudget ? "red" : haz > 0 ? "amber" : "green";
  var mLabel  = routeData.mode === "car" ? "🚗 Car" : routeData.mode === "train" ? "🚆 Train" : "✈ Flight";

  document.getElementById("summary-body").innerHTML =
    "<div class='summary-grid'>"
    + sb("MISSION STATUS", status, stCls)
    + sb("ROUTE", origin.toUpperCase() + " → " + dest.toUpperCase(), "")
    + sb("TRANSPORT", mLabel, "")
    + sb("DURATION", numDays + " DAY(S)", "")
    + sb("TEAM", teamSize + " OPERATIVE(S)", "")
    + sb("TRAVEL TIME", routeData.travelTimeHrs + " HRS", "")
    + sb("AVG TEMPERATURE", avgTemp + "°C", "amber")
    + sb("WEATHER RISK", haz + " / " + weatherDays.length + " DAYS", haz > 0 ? "red" : "green")
    + sb("TOTAL COST", "₹" + budgetData.totalCost.toLocaleString("en-IN"), budgetData.isOverBudget ? "red" : "green")
    + sb("DEPARTURE", formatDateLabel(startDate), "")
    + sb("RETURN", formatDateLabel(endDate), "")
    + sb(
        routeData.mode === "flight" ? "AERIAL DISTANCE" : "ROAD DISTANCE",
        routeData.distanceKm + " KM (1-WAY)",
        ""
      )
    + "</div>";
}

function sb(label, value, cls) {
  return "<div class='summary-block'><div class='sum-label'>" + label + "</div>"
    + "<div class='sum-value " + cls + "'>" + value + "</div></div>";
}

function renderMissionPlan(missionPlan) {
  var html = "<div class='plan-timeline'>";
  missionPlan.forEach(function(day, idx) {
    var isLast = idx === missionPlan.length - 1;
    html += "<div class='plan-day' style='animation-delay:" + (idx * 0.08) + "s'>"
      + "<div class='plan-day-line'>"
      + "<div class='plan-dot " + day.dotColor + "'></div>"
      + (!isLast ? "<div class='plan-vert-line'></div>" : "")
      + "</div>"
      + "<div class='plan-content'>"
      + "<div class='plan-day-label'>DAY " + day.dayNum + " — " + day.label.toUpperCase()
      + (day.weather ? "<span style='font-size:11px;font-weight:400;color:var(--text-dim);margin-left:8px'>"
          + day.weather.emoji + " " + day.weather.temp + "°C — " + day.weather.description + "</span>" : "")
      + "</div>"
      + "<div class='plan-tasks'>"
      + day.tasks.map(function(t) {
          return "<div class='plan-task " + t.type + "'>"
            + "<span class='plan-task-time'>" + t.time + "</span>"
            + "<span class='plan-task-text'>" + t.text + "</span>"
            + "</div>";
        }).join("")
      + "</div></div></div>";
  });
  html += "</div>";
  document.getElementById("plan-body").innerHTML = html;
}

/* ============================================================
   RENDER: SMART PLACES CARD  — new addition
   ============================================================ */
function renderPlacesCard(places, interests) {
  var card  = document.getElementById("places-card");
  var body  = document.getElementById("places-body");
  var badge = document.getElementById("places-badge");

  /* Hide card if no interests were selected */
  if (!interests || interests.length === 0 || !places || places.length === 0) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  badge.textContent = places.length + " PLACES";

  /* Group places by dayAssigned */
  var byDay = {};
  places.forEach(function(p) {
    var key = p.dayAssigned || 0;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(p);
  });

  /* Star renderer — OTM rate is 0–3, display as 0–5 ★ */
  function stars(rate) {
    var normalized = Math.round((rate / 3) * 5);
    var out = "";
    for (var s = 0; s < 5; s++) out += s < normalized ? "★" : "☆";
    return out;
  }

  var html = "";
  var sortedDays = Object.keys(byDay).map(Number).sort(function(a,b){return a-b;});

  sortedDays.forEach(function(dayNum) {
    var dayPlaces = byDay[dayNum];
    var header = dayNum > 0 ? "DAY " + dayNum + " — SUGGESTED VISITS" : "UNSCHEDULED";

    html += "<div class='places-day-group'>"
      + "<div class='places-day-header'>" + header + "</div>";

    /* Sort within the day by bestTime: Morning → Afternoon → Evening → Anytime */
    var timeOrder = { Morning: 0, Afternoon: 1, Evening: 2, Anytime: 3 };
    dayPlaces.sort(function(a, b) {
      return (timeOrder[a.bestTime] || 3) - (timeOrder[b.bestTime] || 3);
    });

    dayPlaces.forEach(function(p) {
      var tagCls  = p.isIndoor ? "indoor" : "outdoor";
      var tagText = p.isIndoor ? "INDOOR" : "OUTDOOR";

      html += "<div class='place-row'>"
        + "<div class='place-info'>"
        + "<div class='place-name'>" + p.emoji + " " + p.name + "</div>"
        + "<div class='place-meta'>"
        + "<span class='place-stars'>" + stars(p.rating) + "</span>"
        + "  " + p.category.toUpperCase()
        + (p.address && p.address !== p.name ? " &nbsp;·&nbsp; " + p.address : "")
        + "</div>"
        + "<span class='place-tag " + tagCls + "'>" + tagText + "</span>"
        + "</div>"
        + "<div class='place-time-badge'>" + p.bestTime.toUpperCase() + "</div>"
        + "</div>";
    });

    html += "</div>";
  });

  body.innerHTML = html;
}
