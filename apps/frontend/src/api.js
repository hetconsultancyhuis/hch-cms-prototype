import { client } from './generated/api/client.gen';
import {
  relationGetAll, relationCreate, relationUpdate, relationDelete,
  locationGetAll, locationCreate, locationUpdate, locationDelete,
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
} from './generated/api/sdk.gen';

// Route all requests through the Vite proxy (dev) or nginx proxy (prod).
// Set VITE_API_BASE in .env to override, e.g. for pointing directly at the microservice.
client.setConfig({ baseUrl: import.meta.env.VITE_API_BASE ?? '' });

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  return data;
}

// Re-export generated functions directly — use these for new features.
export * from './generated/api/sdk.gen';

// Legacy interface — preserved so AppContext, Topbar and Panel need no changes.
// The microservice uses flat routes; parent IDs go in the body, not the URL.
export const api = {
  getRelations:    ()           => unwrap(relationGetAll()),
  createRelation:  (d)          => unwrap(relationCreate({ body: d })),
  updateRelation:  (id, d)      => unwrap(relationUpdate({ body: { id, ...d } })),
  deleteRelation:  (id)         => unwrap(relationDelete({ body: { id } })),

  getLocations:    ()           => unwrap(locationGetAll()),
  createLocation:  (d)          => unwrap(locationCreate({ body: d })),
  updateLocation:  (id, d)      => unwrap(locationUpdate({ body: { id, ...d } })),
  deleteLocation:  (id)         => unwrap(locationDelete({ body: { id } })),

  // locId goes into the body as locationId (flat API — no nested routes)
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
