# Greenhouse CMS — Prototype

A content management tool for modelling greenhouse locations and their energy infrastructure: gas/electricity connections, assets (WKK, boilers, batteries, CO₂ installations, heat pumps), capacity profiles, cultivation periods, and supply contracts.

Data is served entirely by the **Assets API** microservice. 

---

## Architecture

```
Frontend (React + Vite)
  └── api.js  ──HTTP──▶  proxy (/api/*)
                              └──▶  Assets API  :23337
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
│           ├── api.js            # Configures generated client; legacy api export
│           ├── constants.js      # Asset/buffer kinds, Dutch label translations
│           ├── generated/
│           │   └── api/          # AUTO-GENERATED — do not edit by hand
│           │       ├── sdk.gen.ts    # One typed function per microservice operation
│           │       ├── types.gen.ts  # TypeScript types for every DTO
│           │       └── client.gen.ts
│           ├── context/
│           │   └── AppContext.jsx
│           ├── entities/
│           │   └── registry.js       # Entity registry — single file to touch when API adds a resource
│           ├── hooks/
│           │   └── useCanvasKit.js
│           └── components/
│               ├── Topbar.jsx
│               ├── Legend.jsx
│               ├── Modal.jsx
│               ├── Toast.jsx
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

- **Canvas view** — zoomable/pannable schematic of the selected location. All entities are drawn as styled shapes: greenhouses (with expandable cultivation chips), assets (with expandable capacity profiles), buffers, and connections (with inline allocation points and grid contracts). Click to select; scroll to zoom; drag to pan; **F** to fit.
- **Side panel** — collapsible section forms for the selected entity. Save and delete use the entity registry — no hardcoded URLs.
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
    │   └── Assets  (WKK · Boiler · EBoiler · Solar · Battery · HeatPump ·
    │       └── CapacityProfiles   HeatStorage · CO₂ · HeatNetwork · GasLoad · Lighting)
    ├── HeatBuffers
    ├── GasConnections
    │   ├── AllocationPoints → SupplyContracts
    │   └── GasGridContracts
    └── ElectricityConnections
        ├── AllocationPoints → SupplyContracts
        └── ElectricityGridContracts
```

The microservice uses flat routes — parent IDs are passed in the request body, not the URL path. `GET /api/Location` returns the full nested tree including greenhouses in a single response.
