# Greenhouse CMS — Prototype

A content management tool for modelling greenhouse locations and their energy infrastructure: gas/electricity connections, assets (WKK, boilers, batteries, CO₂ installations, heat pumps), capacity profiles, cultivation periods, and supply contracts.

---

## Architecture

```
hch-cms-samax/
├── backend/
│   ├── server.js        # Express REST API
│   ├── db.json          # JSON flat-file database
│   └── seed.js          # One-time data migration helper
└── frontend-react/
    ├── src/
    │   ├── main.jsx             # React entry point
    │   ├── App.jsx              # Root layout, zoom/pan controls
    │   ├── App.css              # Global styles
    │   ├── api.js               # REST client (fetch wrappers)
    │   ├── constants.js         # Asset/buffer kinds, translations
    │   ├── context/
    │   │   └── AppContext.jsx   # Global state (locations, selection, view)
    │   ├── hooks/
    │   │   └── useCanvasKit.js  # Loads CanvasKit WASM + fonts
    │   └── components/
    │       ├── Topbar.jsx       # Relation/location switcher
    │       ├── Legend.jsx       # Map legend + zoom buttons
    │       ├── Modal.jsx        # Create-entity dialog
    │       ├── Toast.jsx        # Notification banner
    │       ├── canvas/
    │       │   ├── CanvasView.jsx  # WebGL surface, pan/zoom/hit-test
    │       │   ├── renderer.js     # Skia draw calls (all entities)
    │       │   └── layout.js       # Layout algorithm (positions/sizes)
    │       └── panel/
    │           ├── Panel.jsx       # Entity detail/edit forms
    │           └── PanelSection.jsx
    └── public/
        ├── canvaskit.wasm          # Skia CanvasKit WASM binary
        ├── NotoSans-Regular.ttf    # Sans-serif font for canvas labels
        └── NotoMono-Regular.ttf    # Monospace font for canvas labels
```

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
| Fonts (canvas) | Noto Sans + Noto Sans Mono (TTF, served locally) |

### Running the frontend

```bash
cd frontend-react
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

> **Note:** The backend must be running on port `3001` for API calls to succeed.

---

## Backend

**Express.js** REST API on port `3001`. Data is persisted in `db.json` (JSON flat-file, read/written on every request — suitable for prototype use).

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

### Running the backend

```bash
cd backend
npm install
npm start          # production — node server.js
npm run dev        # development — node --watch server.js (auto-restart)
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or higher |
| npm | bundled with Node |
| Modern browser | Chrome / Edge recommended (WebGL required for CanvasKit) |

---

## Getting started

Open two terminals:

```bash
# Terminal 1 — backend
cd backend
npm install
npm start

# Terminal 2 — frontend
cd frontend-react
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

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
