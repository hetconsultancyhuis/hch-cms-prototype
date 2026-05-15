import { client } from './generated/api/client.gen';
import {
  relationGetAll, relationCreate, relationUpdate, relationDelete,
  locationGetAll, locationCreate, locationUpdate, locationDelete,
  supplyGetAll,
  greenhouseGetAll,
  assetGetAll,
  capacityProfileGetAll,
  cultivationGetAll,
  heatBufferGetAll,
  gasConnectionGetAll,
  electricityConnectionGetAll,
  allocationPointGetAll,
  greenhouseCreate, greenhouseUpdate, greenhouseDelete,
  cultivationCreate, cultivationUpdate, cultivationDelete,
  assetCreate, assetUpdate, assetDelete,
  capacityProfileCreate, capacityProfileUpdate, capacityProfileDelete,
  heatBufferCreate, heatBufferUpdate, heatBufferDelete,
  gasConnectionCreate, gasConnectionUpdate, gasConnectionDelete,
  electricityConnectionCreate, electricityConnectionUpdate, electricityConnectionDelete,
  allocationPointCreate, allocationPointUpdate, allocationPointDelete,
  supplyContractCreate, supplyContractUpdate, supplyContractDelete,
  gasGridContractCreate, gasGridContractUpdate, gasGridContractDelete,
  electricityGridContractCreate, electricityGridContractUpdate, electricityGridContractDelete,
  gasGridContractGetAll,
  electricityGridContractGetAll,
} from './generated/api/sdk.gen';

// Route all requests through the Vite proxy (dev) or nginx proxy (prod).
client.setConfig({ baseUrl: import.meta.env.VITE_API_BASE ?? '' });

// The microservice returns camelCase JSON; the frontend uses PascalCase throughout.
// Applied inside unwrap so every response is normalised automatically.
function toPascal(obj) {
  if (Array.isArray(obj)) return obj.map(toPascal);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), toPascal(v)])
    );
  }
  return obj;
}

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  return toPascal(data);
}

// ── Location tree builder ─────────────────────────────────────────────────────
//
// Fetches all entity collections in parallel and assembles the nested tree the
// frontend expects. No single endpoint returns the full tree.
//
// Key domain relationships:
//   Supply (assetId + greenhouseId)      → links Assets to Greenhouses
//   AllocationPointAssets[]              → join table linking Asset ↔ AllocationPoint
//   AllocationPoint.gasConnectionId      → links AP to GasConnection
//   AllocationPoint.electricityConnectionId → links AP to ElectricityConnection
//   GasGridContract.gasConnectionId      → nested under GasConnection
//   ElectricityGridContract.electricityConnectionId → nested under ElectricityConnection
//   HeatSupply (heatBufferId+greenhouseId) → links HeatBuffer to Greenhouse → Location
//   GasConnection → Location: derived via AP → Asset → Supply → Greenhouse → Location
//   ElectricityConnection → Location: same derivation path

async function buildLocationTree() {
  const [
    locs, greenhouses, supplies, assets, caps,
    cults, bufs,
    gasConns, elecConns,
    aps, ggcs, egcs,
  ] = await Promise.all([
    unwrap(locationGetAll()),
    unwrap(greenhouseGetAll()),
    unwrap(supplyGetAll()),
    unwrap(assetGetAll()),
    unwrap(capacityProfileGetAll()),
    unwrap(cultivationGetAll()),
    unwrap(heatBufferGetAll()),
    unwrap(gasConnectionGetAll()),
    unwrap(electricityConnectionGetAll()),
    unwrap(allocationPointGetAll()),
    unwrap(gasGridContractGetAll()),
    unwrap(electricityGridContractGetAll()),
  ]);

  // Greenhouses by locationId (GET /api/Greenhouse returns flat list with locationId)
  const ghsByLocId = {};
  for (const gh of (greenhouses || [])) {
    if (!gh.LocationId) continue;
    if (!ghsByLocId[gh.LocationId]) ghsByLocId[gh.LocationId] = [];
    ghsByLocId[gh.LocationId].push(gh);
  }

  // Assets with capacity profiles
  const assetMap = {};
  for (const a of (assets || [])) assetMap[a.Id] = { ...a, Capacities: [] };
  for (const cp of (caps || []))
    if (assetMap[cp.AssetId]) assetMap[cp.AssetId].Capacities.push(cp);

  // Supply → asset-to-greenhouse mapping (Supply has assetId + greenhouseId)
  const assetToGhId = {};
  for (const s of (supplies || []))
    if (s.AssetId && s.GreenhouseId) assetToGhId[s.AssetId] = s.GreenhouseId;
  // Also check supplies nested inside asset responses (if API includes them)
  for (const a of (assets || []))
    for (const s of (a.Supplies || []))
      if (s.GreenhouseId && !assetToGhId[a.Id]) assetToGhId[a.Id] = s.GreenhouseId;

  // Group assets by greenhouse
  const assetsByGh = {};
  for (const a of Object.values(assetMap)) {
    const ghId = assetToGhId[a.Id];
    if (!ghId) continue;
    if (!assetsByGh[ghId]) assetsByGh[ghId] = [];
    assetsByGh[ghId].push(a);
  }

  // Cultivations by greenhouse
  const cultsByGh = {};
  for (const c of (cults || [])) {
    if (!cultsByGh[c.GreenhouseId]) cultsByGh[c.GreenhouseId] = [];
    cultsByGh[c.GreenhouseId].push(c);
  }

  // Allocation points with AssetIds from join table
  const apMap = {};
  for (const ap of (aps || [])) {
    const assetIds = (ap.AllocationPointAssets || []).map(x => x.AssetId).filter(Boolean);
    apMap[ap.Id] = { ...ap, AssetIds: assetIds };
  }

  // Gas connections: nest AllocationPoints + GasGridContracts
  const gasConnMap = {};
  for (const gc of (gasConns || []))
    gasConnMap[gc.Id] = { ...gc, AllocationPoints: gc.AllocationPoints || [], GridContracts: gc.GridContracts || [] };
  for (const ap of Object.values(apMap)) {
    if (ap.GasConnectionId && gasConnMap[ap.GasConnectionId] &&
        !gasConnMap[ap.GasConnectionId].AllocationPoints.find(x => x.Id === ap.Id))
      gasConnMap[ap.GasConnectionId].AllocationPoints.push(ap);
  }
  for (const ggc of (ggcs || []))
    if (ggc.GasConnectionId && gasConnMap[ggc.GasConnectionId])
      gasConnMap[ggc.GasConnectionId].GridContracts.push(ggc);

  // Electricity connections: nest AllocationPoints + ElectricityGridContracts
  const elecConnMap = {};
  for (const ec of (elecConns || []))
    elecConnMap[ec.Id] = { ...ec, AllocationPoints: ec.AllocationPoints || [], GridContracts: ec.GridContracts || [] };
  for (const ap of Object.values(apMap)) {
    if (ap.ElectricityConnectionId && elecConnMap[ap.ElectricityConnectionId] &&
        !elecConnMap[ap.ElectricityConnectionId].AllocationPoints.find(x => x.Id === ap.Id))
      elecConnMap[ap.ElectricityConnectionId].AllocationPoints.push(ap);
  }
  for (const egc of (egcs || []))
    if (egc.ElectricityConnectionId && elecConnMap[egc.ElectricityConnectionId])
      elecConnMap[egc.ElectricityConnectionId].GridContracts.push(egc);

  // Greenhouse-to-location map for connection/buffer derivation
  const ghToLocId = {};
  for (const gh of (greenhouses || []))
    if (gh.LocationId) ghToLocId[gh.Id] = gh.LocationId;

  // Derive locationId for gas connections: conn → AP → asset → supply → greenhouse → location
  const gasConnLocId = {};
  for (const [connId, conn] of Object.entries(gasConnMap)) {
    outer: for (const ap of conn.AllocationPoints) {
      for (const assetId of (ap.AssetIds || [])) {
        const locId = ghToLocId[assetToGhId[assetId]];
        if (locId) { gasConnLocId[connId] = locId; break outer; }
      }
    }
  }

  // Derive locationId for elec connections: same path
  const elecConnLocId = {};
  for (const [connId, conn] of Object.entries(elecConnMap)) {
    outer: for (const ap of conn.AllocationPoints) {
      for (const assetId of (ap.AssetIds || [])) {
        const locId = ghToLocId[assetToGhId[assetId]];
        if (locId) { elecConnLocId[connId] = locId; break outer; }
      }
    }
  }

  // Derive locationId for heat buffers: buffer → HeatSupply.greenhouseId → location
  const bufLocId = {};
  for (const buf of (bufs || []))
    for (const hs of (buf.HeatSupplies || []))
      if (!bufLocId[buf.Id] && hs.GreenhouseId && ghToLocId[hs.GreenhouseId])
        bufLocId[buf.Id] = ghToLocId[hs.GreenhouseId];

  // Assemble full location tree
  return (locs || []).map(loc => {
    // Use fetched greenhouses (flat list with locationId); fall back to nested if API sends them
    const rawGhs = ghsByLocId[loc.Id]?.length ? ghsByLocId[loc.Id] : (loc.Greenhouses || []);
    const locGhs = rawGhs.map(gh => ({
      ...gh,
      Assets: assetsByGh[gh.Id] || [],
      Cultivations: cultsByGh[gh.Id] || (gh.Cultivations || []),
    }));

    const locGasConns  = Object.values(gasConnMap).filter(gc => gasConnLocId[gc.Id] === loc.Id);
    const locElecConns = Object.values(elecConnMap).filter(ec => elecConnLocId[ec.Id] === loc.Id);
    const locBufs      = (bufs || []).filter(bf => bufLocId[bf.Id] === loc.Id);

    return {
      ...loc,
      Greenhouses: locGhs,
      Buffers: locBufs,
      GasConnections: locGasConns,
      ElectricityConnections: locElecConns,
    };
  });
}

// Re-export generated functions directly — use these for new features.
export * from './generated/api/sdk.gen';

// Legacy interface — preserved so AppContext, Topbar and Panel need no changes.
export const api = {
  getRelations:    ()           => unwrap(relationGetAll()),
  getLocations:    ()           => buildLocationTree(),

  createRelation:  (d)          => unwrap(relationCreate({ body: d })),
  updateRelation:  (id, d)      => unwrap(relationUpdate({ body: { id, ...d } })),
  deleteRelation:  (id)         => unwrap(relationDelete({ body: { id } })),

  createLocation:  (d)          => unwrap(locationCreate({ body: d })),
  updateLocation:  (id, d)      => unwrap(locationUpdate({ body: { id, ...d } })),
  deleteLocation:  (id)         => unwrap(locationDelete({ body: { id } })),

  createGreenhouse: (locId, d)  => unwrap(greenhouseCreate({ body: { locationId: locId, ...d } })),
  updateGreenhouse: (id, d)     => unwrap(greenhouseUpdate({ body: { id, ...d } })),
  deleteGreenhouse: (id)        => unwrap(greenhouseDelete({ body: { id } })),

  createCultivation: (ghId, d)  => unwrap(cultivationCreate({ body: { greenhouseId: ghId, ...d } })),
  updateCultivation: (id, d)    => unwrap(cultivationUpdate({ body: { id, ...d } })),
  deleteCultivation: (id)       => unwrap(cultivationDelete({ body: { id } })),

  createAsset:     (ghId, d)    => unwrap(assetCreate({ body: { boilerRoomId: ghId, ...d } })),
  updateAsset:     (id, d)      => unwrap(assetUpdate({ body: { id, ...d } })),
  deleteAsset:     (id)         => unwrap(assetDelete({ body: { id } })),

  createCapacity:  (assetId, d) => unwrap(capacityProfileCreate({ body: { assetId, ...d } })),
  updateCapacity:  (id, d)      => unwrap(capacityProfileUpdate({ body: { id, ...d } })),
  deleteCapacity:  (id)         => unwrap(capacityProfileDelete({ body: { id } })),

  createBuffer:    (locId, d)   => unwrap(heatBufferCreate({ body: { locationId: locId, ...d } })),
  updateBuffer:    (id, d)      => unwrap(heatBufferUpdate({ body: { id, ...d } })),
  deleteBuffer:    (id)         => unwrap(heatBufferDelete({ body: { id } })),

  createGasConnection:  (locId, d)   => unwrap(gasConnectionCreate({ body: { locationId: locId, ...d } })),
  updateGasConnection:  (id, d)      => unwrap(gasConnectionUpdate({ body: { id, ...d } })),
  deleteGasConnection:  (id)         => unwrap(gasConnectionDelete({ body: { id } })),

  createElecConnection: (locId, d)   => unwrap(electricityConnectionCreate({ body: { locationId: locId, ...d } })),
  updateElecConnection: (id, d)      => unwrap(electricityConnectionUpdate({ body: { id, ...d } })),
  deleteElecConnection: (id)         => unwrap(electricityConnectionDelete({ body: { id } })),

  createAllocationPointGas:  (connId, d) => unwrap(allocationPointCreate({ body: { gasConnectionId: connId, ...d } })),
  createAllocationPointElec: (connId, d) => unwrap(allocationPointCreate({ body: { electricityConnectionId: connId, ...d } })),
  updateAllocationPoint: (id, d)         => unwrap(allocationPointUpdate({ body: { id, ...d } })),
  deleteAllocationPoint: (id)            => unwrap(allocationPointDelete({ body: { id } })),

  createSupplyContract:  (apId, d) => unwrap(supplyContractCreate({ body: { allocationPointId: apId, ...d } })),
  updateSupplyContract:  (id, d)   => unwrap(supplyContractUpdate({ body: { id, ...d } })),
  deleteSupplyContract:  (id)      => unwrap(supplyContractDelete({ body: { id } })),

  createGasGridContract:  (connId, d) => unwrap(gasGridContractCreate({ body: { gasConnectionId: connId, ...d } })),
  updateGasGridContract:  (id, d)     => unwrap(gasGridContractUpdate({ body: { id, ...d } })),
  deleteGasGridContract:  (id)        => unwrap(gasGridContractDelete({ body: { id } })),

  createElecGridContract:  (connId, d) => unwrap(electricityGridContractCreate({ body: { electricityConnectionId: connId, ...d } })),
  updateElecGridContract:  (id, d)     => unwrap(electricityGridContractUpdate({ body: { id, ...d } })),
  deleteElecGridContract:  (id)        => unwrap(electricityGridContractDelete({ body: { id } })),
};
