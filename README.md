# 🎯 Mission Planner

A smart, multi-agent operations planning dashboard that orchestrates multiple live APIs (weather, geocoding, routing) into one clean interface — generating step-by-step plans and rough budget estimates automatically, without manual data crunching.

Built as a project to demonstrate **API orchestration**, **fallback/edge-case handling**, and **clean data presentation** rather than raw AI generation — every plan is built strictly from real fetched data.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌦️ **Weather Agent** | Pulls live conditions from OpenWeatherMap `/weather`, and switches to `/forecast` automatically when the trip date is more than a few days out — always shows an "estimate" flag on forecasted data. |
| 🗺️ **Routing Agent** | Calculates the shortest / most efficient route between two points using a custom pathfinding module. |
| 💰 **Budget Estimator (Basic)** | Gives a rough cost breakdown of travel (fuel, public transport, flights) based on distance and mode. |
| 🧭 **Step-by-Step Guidance** | Turns raw API data into a simple day-wise plan (e.g. "Day 1: Travel to City", "Day 2: On-site tasks") in plain language. |
| 🧩 **Agent Orchestration** | Multiple independent JS "agents" (weather, routing, budget) run and combine their data into one final plan — with fallbacks if any single API fails, so the app never breaks silently. |
| 🖥️ **Command Center Dashboard** | All the above shown as clean, readable summary cards instead of raw JSON. |
| ⚠️ **Edge-Case Handling** | Detects conflicting conditions (e.g. severe weather on the route) and adjusts the suggested plan instead of ignoring it. |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript *(no framework — kept lightweight and dependency-free)*
- **APIs Used:**
  - [OpenWeatherMap API](https://openweathermap.org/api) — current weather + 5-day/3-hour forecast
  - Geocoding API — converts place names to coordinates
  - Custom routing/pathfinding logic (`flight-routing` module)
- **Architecture Pattern:** Lightweight multi-agent orchestration — each module (`agents.js`, `flight-routing/`) acts as an independent "agent" that `main.js` coordinates and merges into a single plan
- **Version Control:** Git & GitHub
- **Deployment:** GitHub Pages *(static hosting — no backend server required)*

---

## 📁 Project Structure

```
mission-planner/
├── flight-routing/       # Routing agent - shortest path logic
├── agents.js             # Weather + orchestration agent logic
├── config.js             # API keys & configuration
├── index.html            # App structure / dashboard UI
├── main.js               # Entry point - runs & combines all agents
└── style.css              # Styling
```

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/PariGoyal27/mission-planner.git
cd mission-planner
```

### 2. Add your API key
Open `config.js` and add your own free [OpenWeatherMap API key](https://openweathermap.org/api):
```js
const WEATHER_API_KEY = "your_api_key_here";
```

### 3. Run it locally
No build step needed — just open `index.html` in your browser, or serve it with a simple local server:
```bash
npx serve .
```

---

## 🌐 Live Demo
> _Add your deployed link here once live, e.g._: https://parigoyal27.github.io/mission-planner/

---

## 🧠 How It Works (Short Version)

1. User enters a destination and date.
2. The **weather agent** and **routing agent** fetch data from their respective APIs at the same time.
3. The **budget agent** uses the routing distance to estimate rough travel cost.
4. All three results are merged by `main.js` into one **Pursuit Plan** — a simple, day-wise itinerary.
5. If any API fails or data conflicts (e.g. a storm on the route), the app falls back gracefully and flags it instead of crashing or hallucinating a plan.

---

## 🙌 Contributors
- [Pari Goyal](https://github.com/PariGoyal27)
- [Muskaan Kushwaha](https://github.com/muskaankushwaha)
- [Sneha Singh](https://github.com/snehasingh5134)
- [Nandini Sahu](https://github.com/nandinisahu2120)

---

## 📌 Status
🚧 Actively being built — core agent orchestration and weather logic are complete; budget estimator, step-by-step plan generator, and edge-case handling are in progress.
