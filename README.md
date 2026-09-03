# 🎯 Mission Planner

A multi-agent trip/operations planning dashboard that orchestrates several live APIs — weather, routing, and points-of-interest — in parallel, and turns the results into a clean day-by-day plan with a cost breakdown. Every part of the final plan comes directly from real fetched data, not from AI-generated text, so there's no risk of hallucinated details.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌦️ **Weather Agent** | Fetches current conditions and a 5-day/3-hour forecast from OpenWeatherMap. Falls back gracefully to current weather (flagged as an estimate) when the trip is more than 5 days out or the forecast call fails. |
| 🗺️ **Maps/Routing Agent** | Geocodes both cities via OpenRouteService, fetches real road distance & driving time for car/train, and for flights routes through a custom airport graph (Dijkstra shortest-path) with an automatic Haversine straight-line fallback if routing data is unavailable. |
| 📍 **Places Agent** | Pulls points of interest near the destination from OpenTripMap based on the traveller's selected interests, and distributes them across the itinerary's middle days — preferring indoor venues on hazardous-weather days. |
| 💰 **Budget Agent** | Calculates a detailed cost breakdown (transport, hotel, food, misc) with mode-specific formulas — fuel + toll for car, per-km fare for train, and tiered fare pricing with deterministic demand variability for flights. |
| 🧭 **Plan Generator Agent** | Combines all of the above into a realistic, time-stamped, day-by-day itinerary — arrival/departure logistics, place visits, and weather-aware task scheduling. |
| ⚠️ **Edge-Case Detection** | Flags severe weather on the route, budget overruns (with mode-specific savings tips), long single-day drives, one-day trips, and short-haul flights that would be cheaper by road. |
| 🖥️ **Command Center Dashboard** | Boot sequence, live clock, per-agent status indicators, and summary cards presenting all of the above in one readable view. |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript *(no framework — lightweight, zero build step)*
- **APIs Used:**
  - [OpenWeatherMap API](https://openweathermap.org/api) — current weather + 5-day forecast
  - [OpenRouteService API](https://openrouteservice.org) — geocoding + road directions
  - [OpenTripMap API](https://opentripmap.io) — points of interest / attractions
- **Custom Algorithms:**
  - Haversine formula for great-circle flight distance
  - Dijkstra-based shortest-path routing across a custom airport graph, with automatic fallback
- **Architecture Pattern:** Multi-agent orchestration — 5 independent async "agents" (`weatherAgent`, `mapsAgent`, `budgetAgent`, `placesAgent`, `planGeneratorAgent`) run in `agents.js`, coordinated by a single orchestrator function (`launchMission`) in `main.js`. Weather and routing run in parallel via `Promise.all` for speed; each agent has its own error handling and never silently fails.
- **Version Control:** Git & GitHub
- **Deployment:** GitHub Pages *(static hosting — no backend server required)*

---

## 📁 Project Structure

```
mission-planner/
├── flight-routing/
│   ├── airports-data.js      # Airport coordinate/IATA data
│   ├── airport-utils.js      # City → nearest airport lookup
│   ├── airport-graph.js      # Builds the routing graph
│   └── route-engine.js       # Dijkstra shortest-path engine
├── agents.js                 # All 5 agents: weather, maps, budget, places, plan
├── config.js                 # API keys + cost/speed constants
├── index.html                # Dashboard structure
├── main.js                   # Orchestrator — runs & combines all agents
└── style.css                 # Styling
```

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/PariGoyal27/mission-planner.git
cd mission-planner
```

### 2. Add your API keys
Open `config.js` and fill in:
```js
const WEATHER_API_KEY = "your_openweathermap_key_here";
const ORS_API_KEY = "your_openrouteservice_key_here";
```
Both are free to obtain from [openweathermap.org/api](https://openweathermap.org/api) and [openrouteservice.org](https://openrouteservice.org). Without these, the app falls back to demo/mock data.

### 3. Run it locally
No build step needed. Open `index.html` directly in a browser, or serve it with a local server (recommended, e.g. the VS Code "Live Server" extension) for auto-reload on changes.

---

## 🌐 Live Demo
> https://snehasingh5134.github.io/mission-planner/

---

## 🧠 How It Works (Short Version)

1. User enters origin, destination, travel dates, transport mode, budget, team size, and interests.
2. **Weather** and **Maps** agents run in parallel to fetch live conditions and route data.
3. **Budget** agent uses the route data to calculate a detailed cost breakdown for the chosen transport mode.
4. **Places** agent fetches points of interest matching the user's selected interests.
5. **Plan Generator** combines everything into a day-by-day itinerary with real timestamps.
6. **Edge-case detection** scans the combined data for hazardous weather, budget overruns, and other risk conditions, and surfaces them as alerts.
7. If any single agent fails, the app shows a clear error for that agent instead of silently producing wrong data — the rest of the plan still generates where possible.

---

## 🙌 Contributors
- [Sneha Singh](https://github.com/snehasingh5134)
- [Pari Goyal](https://github.com/PariGoyal27)
- [Muskaan Kushwaha](https://github.com/muskaankushwaha)
- [Nandini Sahu](https://github.com/nandinisahu2120)

---

## 📌 Status
✅ Core system complete — all 5 agents (weather, routing, budget, places, plan generation), edge-case detection, and the command-center dashboard UI are fully functional. Add API keys above to switch from demo data to live results.
