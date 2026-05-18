# Greenhouse CMS — Prototype

A content management tool for modelling greenhouse locations and their energy infrastructure: gas/electricity connections, assets (WKK, boilers, batteries, CO₂ installations, heat pumps), capacity profiles, cultivation periods, and supply contracts.

Data is served entirely by the **Assets API** microservice. 

---

## Demo

https://github.com/user-attachments/assets/f6b4fa10-7556-49f4-950d-2efc59c85a6e

## Architecture

```
Frontend (React + Vite)
  └── api.js  ──HTTP──▶  proxy (/api/*)
                              └──▶  Assets API
```

The repository is an **npm workspace monorepo** with a single app and a docs folder.

```
hch-cms-prototype/
├── package.json                  # Workspace root — dev/build scripts
├── docker-compose.yml            # Orchestrates the frontend container
├── apps/
│   ├── doc/
│   │   └── api.json              # Partial OpenAPI spec (reference only)
│   └── frontend/
│       ├── Dockerfile            # Multi-stage: Vite build → nginx:alpine
│       ├── nginx.conf            # Serves SPA; proxies /api/ → microservice
│       ├── openapi-ts.config.js  # API client code-generator config
│       ├── index.html
│       ├── vite.config.js        # Dev proxy: /api/ → https://localhost:23337
│       └── src/
│           ├── main.jsx
│           ├── App.jsx           # Root layout, zoom/pan controls
│           ├── App.css
│           ├── api.js            # buildLocationTree (14 parallel fetches → nested tree); legacy api export
│           ├── constants.js      # Asset/buffer kinds, ASSET_TYPE_TO_KIND numeric map, assetKindCfg helper, NL labels
│           ├── generated/
│           │   └── api/          # AUTO-GENERATED — do not edit by hand
│           │       ├── sdk.gen.ts    # One typed function per microservice operation
│           │       ├── types.gen.ts  # TypeScript types for every DTO
│           │       └── client.gen.ts
│           ├── context/
│           │   └── AppContext.jsx
│           ├── entities/
│           │   └── registry.js       # Entity registry — single file to touch when API adds a resource
│           └── components/
│               ├── Topbar.jsx
│               ├── Legend.jsx
│               ├── Modal.jsx
│               ├── Toast.jsx
│               ├── TreePanel.jsx     # Left sidebar: clickable location tree
│               ├── canvas/
│               │   ├── CanvasView.jsx
│               │   └── layout.js
│               └── panel/
│                   ├── Panel.jsx
│                   └── PanelSection.jsx
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | |
| Assets API | Must be running and reachable at `https://localhost:23337` |

---

## Running with Docker (recommended)

```bash
docker compose up --build
```

| Service | Container port | Host port |
|---|---|---|
| frontend (nginx) | 80 | 5173 |

Then open **http://localhost:5173**.

nginx proxies all `/api/` requests to `https://host.docker.internal:23337`, so the container reaches the microservice running on the host machine.

---

## Running without Docker

```bash
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

The Vite dev server proxies `/api/` to `https://localhost:23337` (self-signed cert is accepted automatically). The microservice must be running before the frontend will load data.

---

## Frontend

**React 18 + Vite 5**, rendered onto a **Konva** (Canvas 2D) surface.

- **Tree panel** (left sidebar) — compact monospace tree of the selected location: location → greenhouses → assets/cultivations → buffers → gas/elec connections → allocation points/grid contracts. Each row is clickable; the selected item is highlighted in sync with the canvas.
- **Canvas view** — zoomable/pannable schematic of the selected location. Entities rendered as styled Konva shapes: greenhouses (expandable cultivation chips), assets (expandable capacity profiles), buffers, and connections (inline allocation points and grid contracts). Pipe lines connect buffers to their linked greenhouses; dashed connector lines link allocation points to their assets. Selecting an item dims all unrelated objects to 20% opacity. Click to select; scroll to zoom; drag to pan; **F** to fit.
- **Side panel** (right) — collapsible section forms for the selected entity. Save and delete use the entity registry — no hardcoded URLs.
- **Top bar** — filter by relation, switch between locations.

### Technology choices

| Concern | Solution |
|---|---|
| Rendering | Konva / react-konva |
| Framework | React 18 with Context API |
| Build | Vite 5 |
| Production server | nginx:alpine (Docker) |
| API client | `@hey-api/openapi-ts` (auto-generated from live spec) |

---

## Adding a new entity

1. Run `npm run generate-api --workspace=frontend` — new SDK functions appear in `src/generated/api/`
2. Wire them into `api.js` (one `unwrap(...)` line each)
3. Add an entry to `src/entities/registry.js` (label, color, short badge, `apiUpdate`, `apiDelete`)
4. Panel save/delete work automatically via the registry.
5. For canvas visibility, add a layout item in `layout.js` and a node component in `CanvasView.jsx`.

---

## API client code generation

The API client in `src/generated/api/` is auto-generated from the Assets API OpenAPI spec. Regenerate it whenever the microservice adds or changes endpoints:

```bash
# Microservice must be running at http://localhost:10714
npm run generate-api --workspace=frontend
```

This reads `http://localhost:10714/swagger/v1/swagger.json` and overwrites `src/generated/api/`. The generated functions are exported directly from `api.js`, so new endpoints are immediately available.

---

## Data hierarchy

```
Relations
└── Locations
    ├── Greenhouses
    │   ├── Cultivations
    │   ├── Assets  (WKK · Boiler · EBoiler · Solar · Battery · HeatPump ·
    │   │   │        CO₂ · HeatNetwork · GasLoad · OperatingLoad · Lighting)
    │   │   └── CapacityProfiles
    │   └── (linked to HeatBuffers via HeatSupplies join table)
    ├── HeatBuffers  ←──── HeatSupplies (heatBufferId + greenhouseId)
    ├── GasConnections
    │   ├── AllocationPoints ←── AllocationPointAssets (join: allocationPointId + assetId)
    │   │   └── SupplyContracts
    │   └── GasGridContracts
    └── ElectricityConnections
        ├── AllocationPoints ←── AllocationPointAssets (join: allocationPointId + assetId)
        │   └── SupplyContracts
        └── ElectricityGridContracts
```

The microservice uses flat routes — parent IDs are passed in the request body, not the URL path. `buildLocationTree` in `api.js` fetches 14 flat collections in parallel and assembles the nested tree the frontend expects. Location→connection membership is derived via: Greenhouse → Supply → Asset → AllocationPointAsset → AllocationPoint → Connection.
