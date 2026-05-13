# Greenhouse CMS — Prototype

A content management tool for modelling greenhouse locations and their energy infrastructure: gas/electricity connections, assets (WKK, boilers, batteries, CO₂ installations, heat pumps), capacity profiles, cultivation periods, and supply contracts.

---

## Architecture

The repository is an **npm workspace monorepo** with two apps and a shared root configuration.

```
hch-cms-prototype/
├── package.json             # Workspace root — scripts for dev/build
├── docker-compose.yml       # Orchestrates backend + frontend containers
├── apps/
│   ├── backend/
│   │   ├── Dockerfile       # node:22-slim image (builds better-sqlite3)
│   │   ├── server.js        # Express REST API
│   │   ├── db.js            # SQLite database setup (better-sqlite3)
│   │   ├── db.json          # Seed / legacy data file
│   │   └── seed.js          # One-time data migration helper
│   └── frontend/
│       ├── Dockerfile       # Multi-stage: Vite build → nginx:alpine
│       ├── nginx.conf       # Serves SPA; proxies /api/ → backend:3001
│       ├── index.html       # HTML entry point
│       ├── vite.config.js
│       ├── src/
│       │   ├── main.jsx             # React entry point
│       │   ├── App.jsx              # Root layout, zoom/pan controls
│       │   ├── App.css              # Global styles
│       │   ├── api.js               # REST client (fetch wrappers)
│       │   ├── constants.js         # Asset/buffer kinds, translations
│       │   ├── context/
│       │   │   └── AppContext.jsx   # Global state (locations, selection, view)
│       │   ├── hooks/
│       │   │   └── useCanvasKit.js  # Loads CanvasKit WASM + fonts
│       │   └── components/
│       │       ├── Topbar.jsx       # Relation/location switcher
│       │       ├── Legend.jsx       # Map legend + zoom buttons
│       │       ├── Modal.jsx        # Create-entity dialog
│       │       ├── Toast.jsx        # Notification banner
│       │       ├── canvas/
│       │       │   ├── CanvasView.jsx  # WebGL surface, pan/zoom/hit-test
│       │       │   ├── renderer.js     # Skia draw calls (all entities)
│       │       │   └── layout.js       # Layout algorithm (positions/sizes)
│       │       └── panel/
│       │           ├── Panel.jsx       # Entity detail/edit forms
│       │           └── PanelSection.jsx
│       └── public/
│           ├── canvaskit.wasm          # Skia CanvasKit WASM binary
│           ├── NotoSans-Regular.ttf    # Sans-serif font for canvas labels
│           └── NotoMono-Regular.ttf   # Monospace font for canvas labels
```

---

## Running with Docker (recommended)

```bash
docker compose up --build
```

This starts both services:

| Service | Container port | Host port |
|---|---|---|
| frontend (nginx) | 80 | 5173 |
| backend (Express) | 3001 | 3001 |

Then open **http://localhost:5173** in your browser.

`db.json` is bind-mounted into the backend container so data persists across restarts. To reset, delete or empty `apps/backend/db.json` and restart.

### How the Docker setup works

- **Backend** — built from `apps/backend/Dockerfile` using `node:22-slim`. Installs `python3`/`make`/`g++` to compile the `better-sqlite3` native addon, then runs `npm start`.
- **Frontend** — built from `apps/frontend/Dockerfile` using a two-stage build: a `node:22-alpine` builder runs `vite build`, and the resulting `dist/` is copied into an `nginx:alpine` image. The nginx config proxies all `/api/` requests to `backend:3001`, so the frontend never needs to know the backend's host at runtime.

---

## Running without Docker

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 or higher |
| npm | bundled with Node |
| Modern browser | Chrome / Edge recommended (WebGL required for CanvasKit) |

### All services at once (root workspace)

```bash
npm install
npm run dev   # starts backend + frontend concurrently
```

### Individual services

```bash
# Backend — port 3001
npm run dev:backend

# Frontend — port 5173
npm run dev:frontend
```

Or directly inside each app:

```bash
# Terminal 1 — backend
cd apps/backend
npm install
npm run dev        # node --watch server.js (auto-restart)

# Terminal 2 — frontend
cd apps/frontend
npm install
npm run dev        # Vite dev server at http://localhost:5173
```

> **Note:** When running without Docker the frontend Vite dev server proxies `/api/` to `http://localhost:3001` directly. Both services must be running.

---

## Frontend

**React 18 + Vite 5**, rendered onto a **Skia CanvasKit** (WebGL) surface.

- **Canvas view** — zoomable/pannable schematic of the selected location rendered entirely in Skia. Entities (greenhouses, assets, buffers, connections) are drawn as styled shapes with labels. Click to select; scroll to zoom; drag to pan; press `F` to fit.
- **Side panel** — collapsible section forms for the selected entity. Navigates the full data hierarchy; saves via REST on submit.
- **Top bar** — filter by relation, switch between locations.
- **Relation lines** — toggle overlay lines from connections/allocation points to their linked assets.

### Technology choices

| Concern | Solution |
|---|---|
| Rendering | [canvaskit-wasm](https://www.npmjs.com/package/canvaskit-wasm) 0.39.1 (Skia via WebGL) |
| Framework | React 18 with Context API |
| Build | Vite 5 |
| Production server | nginx:alpine (Docker) |
| Fonts (canvas) | Noto Sans + Noto Sans Mono (TTF, served locally) |

---

## Backend

**Express.js** REST API on port `3001`. Data is persisted in a **SQLite** database via `better-sqlite3`.

### Data hierarchy

```
Relations
└── Locations
    ├── Greenhouses
    │   ├── Cultivations
    │   └── Assets  (WKK · Boiler · EBoiler · Solar · Battery · HeatPump ·
    │       │         HeatStorage · CO2Asset · HeatNetwork · GasLoad ·
    │       │         OperatingLoad · Lighting)
    │       └── Capacities
    ├── Buffers  (Heat · CO2)
    ├── GasConnections
    │   └── AllocationPoints → SupplyContracts
    │   └── GridContracts
    └── ElectricityConnections
        └── AllocationPoints → SupplyContracts
        └── GridContracts
```

---

## API overview

All routes are prefixed with `/api/`. `GET /api/locations` returns the full nested tree in a single response.

| Resource | Endpoints |
|---|---|
| Relations | `GET/POST /api/relations` · `PUT/DELETE /api/relations/:id` |
| Locations | `GET/POST /api/locations` · `GET/PUT/DELETE /api/locations/:id` |
| Greenhouses | `POST /api/locations/:locId/greenhouses` · `PUT/DELETE /api/greenhouses/:id` |
| Cultivations | `POST /api/greenhouses/:ghId/cultivations` · `PUT/DELETE /api/cultivations/:id` |
| Assets | `POST /api/greenhouses/:ghId/assets` · `PUT/DELETE /api/assets/:id` |
| Capacities | `POST /api/assets/:assetId/capacities` · `PUT/DELETE /api/capacities/:id` |
| Buffers | `POST /api/locations/:locId/buffers` · `PUT/DELETE /api/buffers/:id` |
| Gas connections | `POST /api/locations/:locId/gasconnections` · `PUT/DELETE /api/gasconnections/:id` |
| Electricity connections | `POST /api/locations/:locId/electricityconnections` · `PUT/DELETE /api/electricityconnections/:id` |
| Allocation points (gas) | `POST /api/gasconnections/:connId/allocationpoints` · `PUT/DELETE /api/allocationpoints/:id` |
| Allocation points (elec) | `POST /api/electricityconnections/:connId/allocationpoints` |
| Supply contracts | `POST /api/allocationpoints/:apId/contracts` · `PUT/DELETE /api/supplycontracts/:id` |
| Gas grid contracts | `POST /api/gasconnections/:connId/gasgridcontracts` · `PUT/DELETE /api/gasgridcontracts/:id` |
| Electricity grid contracts | `POST /api/electricityconnections/:connId/electricitygridcontracts` · `PUT/DELETE /api/electricitygridcontracts/:id` |
