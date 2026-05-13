import { API_BASE } from './constants';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null && body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getRelations: () => req('GET', '/relations'),
  createRelation: (d) => req('POST', '/relations', d),
  updateRelation: (id, d) => req('PUT', `/relations/${id}`, d),
  deleteRelation: (id) => req('DELETE', `/relations/${id}`),

  getLocations: () => req('GET', '/locations'),
  createLocation: (d) => req('POST', '/locations', d),
  updateLocation: (id, d) => req('PUT', `/locations/${id}`, d),
  deleteLocation: (id) => req('DELETE', `/locations/${id}`),

  createGreenhouse: (locId, d) => req('POST', `/locations/${locId}/greenhouses`, d),
  updateGreenhouse: (id, d) => req('PUT', `/greenhouses/${id}`, d),
  deleteGreenhouse: (id) => req('DELETE', `/greenhouses/${id}`),

  createCultivation: (ghId, d) => req('POST', `/greenhouses/${ghId}/cultivations`, d),
  updateCultivation: (id, d) => req('PUT', `/cultivations/${id}`, d),
  deleteCultivation: (id) => req('DELETE', `/cultivations/${id}`),

  createAsset: (ghId, d) => req('POST', `/greenhouses/${ghId}/assets`, d),
  updateAsset: (id, d) => req('PUT', `/assets/${id}`, d),
  deleteAsset: (id) => req('DELETE', `/assets/${id}`),

  createCapacity: (assetId, d) => req('POST', `/assets/${assetId}/capacities`, d),
  updateCapacity: (id, d) => req('PUT', `/capacities/${id}`, d),
  deleteCapacity: (id) => req('DELETE', `/capacities/${id}`),

  createBuffer: (locId, d) => req('POST', `/locations/${locId}/buffers`, d),
  updateBuffer: (id, d) => req('PUT', `/buffers/${id}`, d),
  deleteBuffer: (id) => req('DELETE', `/buffers/${id}`),

  createGasConnection: (locId, d) => req('POST', `/locations/${locId}/gasconnections`, d),
  updateGasConnection: (id, d) => req('PUT', `/gasconnections/${id}`, d),
  deleteGasConnection: (id) => req('DELETE', `/gasconnections/${id}`),

  createElecConnection: (locId, d) => req('POST', `/locations/${locId}/electricityconnections`, d),
  updateElecConnection: (id, d) => req('PUT', `/electricityconnections/${id}`, d),
  deleteElecConnection: (id) => req('DELETE', `/electricityconnections/${id}`),

  createAllocationPointGas: (connId, d) => req('POST', `/gasconnections/${connId}/allocationpoints`, d),
  createAllocationPointElec: (connId, d) => req('POST', `/electricityconnections/${connId}/allocationpoints`, d),
  updateAllocationPoint: (id, d) => req('PUT', `/allocationpoints/${id}`, d),
  deleteAllocationPoint: (id) => req('DELETE', `/allocationpoints/${id}`),

  createSupplyContract: (apId, d) => req('POST', `/allocationpoints/${apId}/contracts`, d),
  updateSupplyContract: (id, d) => req('PUT', `/supplycontracts/${id}`, d),
  deleteSupplyContract: (id) => req('DELETE', `/supplycontracts/${id}`),

  createGasGridContract: (connId, d) => req('POST', `/gasconnections/${connId}/gasgridcontracts`, d),
  updateGasGridContract: (id, d) => req('PUT', `/gasgridcontracts/${id}`, d),
  deleteGasGridContract: (id) => req('DELETE', `/gasgridcontracts/${id}`),

  createElecGridContract: (connId, d) => req('POST', `/electricityconnections/${connId}/electricitygridcontracts`, d),
  updateElecGridContract: (id, d) => req('PUT', `/electricitygridcontracts/${id}`, d),
  deleteElecGridContract: (id) => req('DELETE', `/electricitygridcontracts/${id}`),
};
