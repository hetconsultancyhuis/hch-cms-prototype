// Central entity registry — the single place to touch when the API adds a new resource.
//
// Adding a new entity:
//  1. Run `npm run generate-api` → new SDK functions appear in src/generated/api/
//  2. Wire them into api.js (one line each)
//  3. Add an entry here
//  4. The Panel save/delete works automatically.
//     For canvas visibility, add a layout item + a canvas node in CanvasView.jsx.

import { api } from '../api';

export const ENTITY_REGISTRY = {
  relation: {
    label: 'Relatie',
    color: '#0f172a',
    short: 'RE',
    apiUpdate: api.updateRelation,
    apiDelete: api.deleteRelation,
  },
  location: {
    label: 'Locatie',
    color: '#0f172a',
    short: 'LC',
    apiUpdate: api.updateLocation,
    apiDelete: api.deleteLocation,
  },
  greenhouse: {
    label: 'Kas',
    color: '#0e7490',
    short: 'KS',
    apiUpdate: api.updateGreenhouse,
    apiDelete: api.deleteGreenhouse,
  },
  cultivation: {
    label: 'Teelt',
    color: '#15803d',
    short: 'TL',
    apiUpdate: api.updateCultivation,
    apiDelete: api.deleteCultivation,
  },
  asset: {
    label: 'Asset',
    color: '#b45309',
    short: 'AS',
    apiUpdate: api.updateAsset,
    apiDelete: api.deleteAsset,
  },
  capacity: {
    label: 'Capaciteitsprofiel',
    color: '#475569',
    short: 'CP',
    apiUpdate: api.updateCapacity,
    apiDelete: api.deleteCapacity,
  },
  buffer: {
    label: 'Buffer',
    color: '#b91c1c',
    short: 'BU',
    apiUpdate: api.updateBuffer,
    apiDelete: api.deleteBuffer,
  },
  gasconn: {
    label: 'Gasaansluiting',
    color: '#b45309',
    short: 'GAS',
    apiUpdate: api.updateGasConnection,
    apiDelete: api.deleteGasConnection,
  },
  elecconn: {
    label: 'Elektriciteitsaansluiting',
    color: '#1d4ed8',
    short: 'ELE',
    apiUpdate: api.updateElecConnection,
    apiDelete: api.deleteElecConnection,
  },
  allocationpoint: {
    label: 'Allocatiepunt',
    color: '#6d28d9',
    short: 'AP',
    apiUpdate: api.updateAllocationPoint,
    apiDelete: api.deleteAllocationPoint,
  },
  allocationpointasset: {
    label: 'Allocatiepunt-asset koppeling',
    color: '#6d28d9',
    short: 'APA',
    apiUpdate: api.updateAllocationPointAsset,
    apiDelete: api.deleteAllocationPointAsset,
  },
  supplycontract: {
    label: 'Leveringscontract',
    color: '#0f172a',
    short: 'SC',
    apiUpdate: api.updateSupplyContract,
    apiDelete: api.deleteSupplyContract,
  },
  gasGridContract: {
    label: 'Gas netkostencontract',
    color: '#92400e',
    short: 'GGC',
    apiUpdate: api.updateGasGridContract,
    apiDelete: api.deleteGasGridContract,
  },
  elecGridContract: {
    label: 'Elektriciteit netkostencontract',
    color: '#1e40af',
    short: 'EGC',
    apiUpdate: api.updateElecGridContract,
    apiDelete: api.deleteElecGridContract,
  },
};
