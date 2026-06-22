const WEATHER_API_KEY = "4df7be8cda082d2db5edff3d10c47478";
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA4ODRkNDVjNjMyODQxYzBhMTY5YjY1ZDVkMTc0ZWQ4IiwiaCI6Im11cm11cjY0In0=";

/* ────────────────────────────────────────────────────────
   COST TABLE  (India realistic, 2025)

   FOR CAR:
     Fuel = (distance × 2) ÷ 15 km/L × ₹102/L
     Toll = distance × 2 × ₹1.5/km

   FOR TRAIN (Sleeper class):
     Fare = distance × ₹1.2/km × persons × 2 (return)

   FLIGHT (uses aerial/Haversine distance, not road distance):
     Distance tiers with realistic base fares:
       < 500 km  → ₹3,200 base  (short-haul, e.g. Delhi–Jaipur)
       500–999   → ₹5,500 base  (medium, e.g. Delhi–Mumbai)
       1000–1999 → ₹7,800 base  (long, e.g. Delhi–Bangalore)
       ≥ 2000    → ₹11,000 base (very long, e.g. Delhi–Port Blair)
     + ₹2.5/km above tier threshold (marginal km cost)
     + ₹850 airport taxes + fees per ticket
     ± 10–20% variability using a deterministic seed
       (simulates real-world dynamic pricing)
     × persons × 2 (return)

   HOTEL:  ₹1,200 / night / person
   FOOD:   ₹500   / day  / person
   MISC:   ₹200   / day  / person
   ───────────────────────────────────────────────────────── */
const COSTS = {
  petrolPerLitre: 102,
  carKmPerLitre: 15,
  tollPerKm: 1.5,
  trainSleeperPerKm: 1.2,

  // Flight pricing tiers: [minKm, baseFare, marginalPerKm]
  flightTiers: [
    { min: 0, max: 499, base: 3200, marginal: 2.0 },
    { min: 500, max: 999, base: 5500, marginal: 2.5 },
    { min: 1000, max: 1999, base: 7800, marginal: 3.0 },
    { min: 2000, max: Infinity, base: 11000, marginal: 3.5 },
  ],
  flightTaxPerTicket: 850, // airport tax + fuel surcharge + GST approx
  flightVariabilityMin: 0.88, // -12% minimum multiplier
  flightVariabilityMax: 1.22, // +22% maximum multiplier

  hotelPerNightPerson: 1200,
  foodPerDayPerson: 500,
  miscPerDayPerson: 200,
};

/* ─────────────────────────────────────────────────────────
   TRAVEL SPEED (for time calculation per mode)

   ORS always gives ROAD DRIVING time.
   We use it directly for CAR.
   For TRAIN and FLIGHT we calculate separately:

   TRAIN:  avg Indian train = 60 km/h + 2 hr station buffer
   FLIGHT: avg flight speed = 700 km/h + 3 hr airport buffer
   ───────────────────────────────────────────────────────── */
const SPEED = { train: 60, flight: 700 };

/* 
   UTILITIES
    */
function avgArr(arr) {
  return arr.length
    ? arr.reduce(function (a, b) {
        return a + b;
      }, 0) / arr.length
    : 0;
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function getDaysBetween(startDate, endDate) {
  var days = [];
  var cur = new Date(startDate + "T00:00:00");
  var end = new Date(endDate + "T00:00:00");

  while (cur <= end) {
    days.push(
      cur.getFullYear() +
      "-" +
      String(cur.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(cur.getDate()).padStart(2, "0")
    );

    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

function formatDateLabel(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatHrMin(hrs) {
  var h = Math.floor(hrs) % 24;
  var m = Math.round((hrs % 1) * 60);
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}
