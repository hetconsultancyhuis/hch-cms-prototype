const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');

// ── Microservice proxy ────────────────────────────────────────
const MICROSERVICE_URL = process.env.MICROSERVICE_URL || 'https://localhost:23337';
// Self-signed cert on the upstream service — only affects calls through upstreamAgent
const upstreamAgent = new https.Agent({ rejectUnauthorized: false });

function upstreamGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, MICROSERVICE_URL);
    https.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search,
        method: 'GET', headers: { Accept: 'application/json' }, agent: upstreamAgent },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          if (res.statusCode >= 400) return reject(new Error(`Upstream returned ${res.statusCode}`));
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }
    ).on('error', reject).end();
  });
}

// Asset type endpoints and their frontend Kind values
const ASSET_ENDPOINTS = [
  { path: '/api/Asset/WKK',         kind: 'WKK' },
  { path: '/api/Asset/Boiler',      kind: 'Boiler' },
  { path: '/api/Asset/EBoiler',     kind: 'EBoiler' },
  { path: '/api/Asset/Solar',       kind: 'Solar' },
  { path: '/api/Asset/CO2',         kind: 'CO2Asset' },
  { path: '/api/Asset/HeatNetwork', kind: 'HeatNetwork' },
  { path: '/api/Asset/HeatPump',    kind: 'HeatPump' },
];

function mapAsset(a, kind) {
  return {
    Id: a.id,
    Name: a.name || '',
    Description: a.description || '',
    Kind: kind,
    Capacities: (a.capacityProfiles || []).map(cp => ({
      Id: cp.id,
      Name: cp.name || '',
      Description: cp.description || '',
    })),
  };
}

function mapCultivation(c) {
  return {
    Id: c.id,
    Name: c.name || '',
    Description: c.description || '',
    DateStart: c.dateStart || '',
    DateEnd: c.dateEnd || null,
    SquareMeters: c.squareMeters || 0,
    MaximumElectricityUsage: 0,
    Lit: false,
    PublicId: c.publicId || '',
    BMEXSectionId: '',
  };
}

function mapGreenhouse(gh, assetMap, ghAssetIds) {
  const ids = ghAssetIds[(gh.id || '').toLowerCase()] || [];
  const assets = ids.map(id => assetMap[id]).filter(Boolean);
  return {
    Id: gh.id,
    Name: gh.name || '',
    ShortName: '',
    Description: gh.description || '',
    SquareMeters: 0,
    MaximumElectricityUsage: gh.maximumElectricityUsage || 0,
    LetsGrowItemId: gh.letsGrowItemId || 0,
    Cultivations: (gh.cultivations || []).map(mapCultivation),
    Assets: assets,
    GasSupply: { Id: '', EANCode: '', DNOConnectionId: '' },
    ElectricitySupply: { Id: '', EANCode: '', DNOConnectionId: '' },
  };
}

function mapLocation(loc, greenhouses, assetMap, ghAssetIds) {
  const addr = loc.address || {};
  return {
    Id: loc.id,
    RelationId: loc.relationId || null,
    PublicId: loc.publicId || 0,
    Name: loc.name || '',
    InternalName: loc.internalName || '',
    PlanName: loc.planName || '',
    Description: loc.description || '',
    DNOName: loc.dnoName || '',
    DNOCustomerId: loc.dnoCustomerId || '',
    Address: { AddressLine: addr.addressLine || '', PostalCode: addr.postalCode || '', City: addr.city || '' },
    Greenhouses: greenhouses.map(gh => mapGreenhouse(gh, assetMap, ghAssetIds)),
    Buffers: [],
    GasConnections: [],
    ElectricityConnections: [],
  };
}

const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const writeDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
const newId = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8);

// Tree traversal helpers
function findLocation(db, id) {
  return db.locations.find(l => l.Id === id);
}
function findGreenhouse(db, id) {
  for (const loc of db.locations) {
    const gh = (loc.Greenhouses || []).find(g => g.Id === id);
    if (gh) return { gh, loc };
  }
  return null;
}
function findAsset(db, id) {
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      const a = (gh.Assets || []).find(a => a.Id === id);
      if (a) return { a, gh, loc };
    }
  }
  return null;
}
function findCapacity(db, id) {
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      for (const asset of (gh.Assets || [])) {
        const cp = asset.Capacities.find(c => c.Id === id);
        if (cp) return { cp, asset, gh, loc };
      }
    }
  }
  return null;
}
function findSchedule(db, id) {
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      for (const asset of (gh.Assets || [])) {
        const s = (asset.Schedules || []).find(s => s.Id === id);
        if (s) return { s, asset, gh, loc };
      }
    }
  }
  return null;
}
function findBuffer(db, id) {
  for (const loc of db.locations) {
    const buf = (loc.Buffers || []).find(b => b.Id === id);
    if (buf) return { buf, loc };
  }
  return null;
}
function findRelation(db, id) {
  return (db.relations || []).find(r => r.Id === id);
}
function findCultivation(db, id) {
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      const cult = (gh.Cultivations || []).find(c => c.Id === id);
      if (cult) return { cult, gh, loc };
    }
  }
  return null;
}
function findSupplyContract(db, id) {
  for (const loc of db.locations) {
    for (const conn of [...(loc.GasConnections || []), ...(loc.ElectricityConnections || [])]) {
      for (const ap of (conn.AllocationPoints || [])) {
        const sc = (ap.Contracts || []).find(c => c.Id === id);
        if (sc) return { sc, ap, conn, loc };
      }
    }
  }
  return null;
}

function findGasConnection(db, id) {
  for (const loc of db.locations) {
    const gc = (loc.GasConnections || []).find(c => c.Id === id);
    if (gc) return { gc, loc };
  }
  return null;
}
function findElecConnection(db, id) {
  for (const loc of db.locations) {
    const ec = (loc.ElectricityConnections || []).find(c => c.Id === id);
    if (ec) return { ec, loc };
  }
  return null;
}
function findAllocationPoint(db, id) {
  for (const loc of db.locations) {
    for (const gc of (loc.GasConnections || [])) {
      const ap = (gc.AllocationPoints || []).find(a => a.Id === id);
      if (ap) return { ap, conn: gc, connKind: 'gas', loc };
    }
    for (const ec of (loc.ElectricityConnections || [])) {
      const ap = (ec.AllocationPoints || []).find(a => a.Id === id);
      if (ap) return { ap, conn: ec, connKind: 'elec', loc };
    }
  }
  return null;
}
function findGasGridContract(db, id) {
  for (const loc of db.locations) {
    for (const gc of (loc.GasConnections || [])) {
      const ggc = (gc.GridContracts || []).find(c => c.Id === id);
      if (ggc) return { ggc, conn: gc, loc };
    }
  }
  return null;
}
function findElecGridContract(db, id) {
  for (const loc of db.locations) {
    for (const ec of (loc.ElectricityConnections || [])) {
      const egc = (ec.GridContracts || []).find(c => c.Id === id);
      if (egc) return { egc, conn: ec, loc };
    }
  }
  return null;
}

function pick(body, keys) {
  const out = {};
  for (const k of keys) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// ── Relations ────────────────────────────────────────────────
app.get('/api/relations', (req, res) => res.json(readDb().relations || []));
app.get('/api/relations/:id', (req, res) => {
  const rel = findRelation(readDb(), req.params.id);
  return rel ? res.json(rel) : res.status(404).json({ error: 'Not found' });
});
app.post('/api/relations', (req, res) => {
  const db = readDb();
  if (!db.relations) db.relations = [];
  const rel = {
    Id: newId('rel'), Name: req.body.Name || 'Nieuwe relatie',
    Description: req.body.Description || '',
    Address: req.body.Address || { AddressLine: '', PostalCode: '', City: '' }
  };
  db.relations.push(rel);
  writeDb(db);
  res.status(201).json(rel);
});
app.put('/api/relations/:id', (req, res) => {
  const db = readDb();
  const rel = findRelation(db, req.params.id);
  if (!rel) return res.status(404).json({ error: 'Not found' });
  Object.assign(rel, pick(req.body, ['Name', 'Description', 'Address']));
  writeDb(db);
  res.json(rel);
});
app.delete('/api/relations/:id', (req, res) => {
  const db = readDb();
  if (!db.relations) return res.status(404).json({ error: 'Not found' });
  const idx = db.relations.findIndex(r => r.Id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.relations.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// ── Locations ────────────────────────────────────────────────
app.get('/api/locations', async (req, res) => {
  try {
    const [locations, greenhouses, supplies, ...assetResults] = await Promise.all([
      upstreamGet('/api/Location'),
      upstreamGet('/api/Greenhouse'),
      upstreamGet('/api/Supply').catch(() => []),
      ...ASSET_ENDPOINTS.map(ep => upstreamGet(ep.path).then(list => ({ list, kind: ep.kind })).catch(() => ({ list: [], kind: ep.kind }))),
    ]);

    // Build assetId (lowercase) -> mapped asset lookup
    const assetMap = {};
    for (const { list, kind } of assetResults) {
      for (const a of list) {
        const key = (a.id || '').toLowerCase();
        if (key) assetMap[key] = mapAsset(a, kind);
      }
    }

    // Build greenhouseId (lowercase) -> [assetId, ...] from supplies
    const ghAssetIds = {};
    for (const s of supplies) {
      const ghId  = (s.greenhouseId || '').toLowerCase();
      const aId   = (s.assetId || '').toLowerCase();
      if (ghId && aId) (ghAssetIds[ghId] ??= []).push(aId);
    }

    console.log(`[upstream] locations: ${locations.length}, greenhouses: ${greenhouses.length}, assets: ${Object.keys(assetMap).length}, supplies: ${supplies.length}`);

    // Index greenhouses by id and locationId (lowercase for GUID casing safety)
    const ghById = {};
    const ghByLocationId = {};
    for (const gh of greenhouses) {
      ghById[(gh.id || '').toLowerCase()] = gh;
      const locId = (gh.locationId || '').toLowerCase();
      if (locId) (ghByLocationId[locId] ??= []).push(gh);
    }

    res.json(locations.map(loc => {
      const locId = (loc.id || '').toLowerCase();
      const embedded = loc.greenhouses || [];
      const ghs = embedded.length
        ? embedded.map(e => ghById[(e.id || '').toLowerCase()] ?? e)
        : (ghByLocationId[locId] ?? []);
      return mapLocation(loc, ghs, assetMap, ghAssetIds);
    }));
  } catch (err) {
    console.error('Microservice error:', err.message);
    res.status(502).json({ error: 'Could not reach upstream service', detail: err.message });
  }
});
app.get('/api/locations/:id', (req, res) => {
  const loc = findLocation(readDb(), req.params.id);
  return loc ? res.json(loc) : res.status(404).json({ error: 'Not found' });
});
app.post('/api/locations', (req, res) => {
  const db = readDb();
  const loc = {
    Id: newId('loc'), PublicId: Math.floor(Math.random() * 8000) + 1000,
    RelationId: req.body.RelationId || null,
    Name: req.body.Name || 'Nieuwe locatie', InternalName: req.body.InternalName || '',
    PlanName: req.body.PlanName || '', Description: req.body.Description || '',
    DNOName: req.body.DNOName || '', DNOCustomerId: req.body.DNOCustomerId || '',
    Address: req.body.Address || { AddressLine: '', PostalCode: '', City: '' },
    Greenhouses: [], Buffers: []
  };
  db.locations.push(loc);
  writeDb(db);
  res.status(201).json(loc);
});
app.put('/api/locations/:id', (req, res) => {
  const db = readDb();
  const loc = findLocation(db, req.params.id);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  Object.assign(loc, pick(req.body, ['Name','InternalName','PlanName','Description','DNOName','DNOCustomerId','RelationId','Address']));
  writeDb(db);
  res.json(loc);
});
app.delete('/api/locations/:id', (req, res) => {
  const db = readDb();
  const idx = db.locations.findIndex(l => l.Id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.locations.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// ── Greenhouses ───────────────────────────────────────────────
app.post('/api/locations/:locId/greenhouses', (req, res) => {
  const db = readDb();
  const loc = findLocation(db, req.params.locId);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const gh = {
    Id: newId('gh'), Name: req.body.Name || 'Nieuwe kas',
    ShortName: req.body.ShortName || '', Description: req.body.Description || '',
    SquareMeters: req.body.SquareMeters || 0,
    MaximumElectricityUsage: req.body.MaximumElectricityUsage || 0,
    LetsGrowItemId: req.body.LetsGrowItemId || 0,
    Cultivations: [], Assets: [],
    GasSupply: { Id: newId('gs'), EANCode: '', DNOConnectionId: '' },
    ElectricitySupply: { Id: newId('es'), EANCode: '', DNOConnectionId: '' }
  };
  if (!loc.Greenhouses) loc.Greenhouses = [];
  loc.Greenhouses.push(gh);
  writeDb(db);
  res.status(201).json(gh);
});
app.put('/api/greenhouses/:id', (req, res) => {
  const db = readDb();
  const result = findGreenhouse(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.gh, pick(req.body, ['Name','ShortName','Description','SquareMeters','MaximumElectricityUsage','LetsGrowItemId']));
  writeDb(db);
  res.json(result.gh);
});
app.delete('/api/greenhouses/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    const idx = (loc.Greenhouses || []).findIndex(g => g.Id === req.params.id);
    if (idx !== -1) { loc.Greenhouses.splice(idx, 1); writeDb(db); return res.status(204).end(); }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Cultivations ──────────────────────────────────────────────
app.post('/api/greenhouses/:ghId/cultivations', (req, res) => {
  const db = readDb();
  const result = findGreenhouse(db, req.params.ghId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const cult = {
    Id: newId('cult'), Name: req.body.Name || 'Nieuwe teelt',
    Description: req.body.Description || '', DateStart: req.body.DateStart || '',
    DateEnd: req.body.DateEnd || null, SquareMeters: req.body.SquareMeters || 0,
    MaximumElectricityUsage: req.body.MaximumElectricityUsage || 0,
    Lit: req.body.Lit || false, PublicId: req.body.PublicId || '',
    BMEXSectionId: req.body.BMEXSectionId || ''
  };
  if (!result.gh.Cultivations) result.gh.Cultivations = [];
  result.gh.Cultivations.push(cult);
  writeDb(db);
  res.status(201).json(cult);
});
app.put('/api/cultivations/:id', (req, res) => {
  const db = readDb();
  const result = findCultivation(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.cult, pick(req.body, ['Name','Description','DateStart','DateEnd','SquareMeters','MaximumElectricityUsage','Lit','PublicId','BMEXSectionId']));
  writeDb(db);
  res.json(result.cult);
});
app.delete('/api/cultivations/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      const idx = (gh.Cultivations || []).findIndex(c => c.Id === req.params.id);
      if (idx !== -1) { gh.Cultivations.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Assets ────────────────────────────────────────────────────
app.post('/api/greenhouses/:ghId/assets', (req, res) => {
  const db = readDb();
  const result = findGreenhouse(db, req.params.ghId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const asset = {
    Id: newId('a'), Kind: req.body.Kind || 'WKK',
    Name: req.body.Name || 'Nieuw asset', Description: req.body.Description || '',
    BufferId: req.body.BufferId || null, AllocationPointId: req.body.AllocationPointId || null,
    extra: req.body.extra || {}, Capacities: [], Schedules: []
  };
  if (!result.gh.Assets) result.gh.Assets = [];
  result.gh.Assets.push(asset);
  writeDb(db);
  res.status(201).json(asset);
});
app.put('/api/assets/:id', (req, res) => {
  const db = readDb();
  const result = findAsset(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.a, pick(req.body, ['Name','Description','Kind','BufferId','AllocationPointId','extra']));
  writeDb(db);
  res.json(result.a);
});
app.delete('/api/assets/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      const idx = (gh.Assets || []).findIndex(a => a.Id === req.params.id);
      if (idx !== -1) { gh.Assets.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Capacities ────────────────────────────────────────────────
app.post('/api/assets/:assetId/capacities', (req, res) => {
  const db = readDb();
  const result = findAsset(db, req.params.assetId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const cp = {
    Id: newId('cp'), Name: req.body.Name || 'Nieuw profiel',
    Description: '', DateStart: '', DateEnd: null,
    ElectricityProduction: 0, HeatProduction: 0, CO2Production: 0,
    GasUsage: 0, ElectricityUsage: 0, Efficiency: 0,
    ElectricCapacity: 0, MaximalCharge: 0, MinimalCharge: 0, UreumLoad: null,
    BidComponentId: '', ReservePowerUpBidComponentId: '', ReservePowerDownBidComponentId: '',
    CatalogCO2Production: null, CatalogElectricityConsumption: null,
    CatalogElectricityProduction: null, CatalogGasUsage: null, CatalogHeatProduction: null,
    ...pick(req.body, ['Name','Description','DateStart','DateEnd','ElectricityProduction','HeatProduction','CO2Production','GasUsage','ElectricityUsage','Efficiency','ElectricCapacity','MaximalCharge','MinimalCharge','UreumLoad','BidComponentId','ReservePowerUpBidComponentId','ReservePowerDownBidComponentId','CatalogCO2Production','CatalogElectricityConsumption','CatalogElectricityProduction','CatalogGasUsage','CatalogHeatProduction'])
  };
  result.a.Capacities.push(cp);
  writeDb(db);
  res.status(201).json(cp);
});
app.put('/api/capacities/:id', (req, res) => {
  const db = readDb();
  const result = findCapacity(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.cp, pick(req.body, ['Name','Description','DateStart','DateEnd','ElectricityProduction','HeatProduction','CO2Production','GasUsage','ElectricityUsage','Efficiency','ElectricCapacity','MaximalCharge','MinimalCharge','UreumLoad','BidComponentId','ReservePowerUpBidComponentId','ReservePowerDownBidComponentId','CatalogCO2Production','CatalogElectricityConsumption','CatalogElectricityProduction','CatalogGasUsage','CatalogHeatProduction']));
  writeDb(db);
  res.json(result.cp);
});
app.delete('/api/capacities/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      for (const asset of (gh.Assets || [])) {
        const idx = asset.Capacities.findIndex(c => c.Id === req.params.id);
        if (idx !== -1) { asset.Capacities.splice(idx, 1); writeDb(db); return res.status(204).end(); }
      }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Buffers ───────────────────────────────────────────────────
app.post('/api/locations/:locId/buffers', (req, res) => {
  const db = readDb();
  const loc = findLocation(db, req.params.locId);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const buf = {
    Id: newId('buf'), Kind: req.body.Kind || 'Heat',
    Name: req.body.Name || 'Nieuwe buffer', Description: req.body.Description || '',
    Volume: req.body.Volume || 0, GreenhouseIds: req.body.GreenhouseIds || [],
    ...pick(req.body, ['MinTemperature','MaxTemperature','MaxPressure'])
  };
  if (!loc.Buffers) loc.Buffers = [];
  loc.Buffers.push(buf);
  writeDb(db);
  res.status(201).json(buf);
});
app.put('/api/buffers/:id', (req, res) => {
  const db = readDb();
  const result = findBuffer(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  if (req.body.GreenhouseIds !== undefined) result.buf.GreenhouseIds = req.body.GreenhouseIds;
  Object.assign(result.buf, pick(req.body, ['Name','Description','Kind','Volume','MinTemperature','MaxTemperature','MaxPressure']));
  writeDb(db);
  res.json(result.buf);
});
app.delete('/api/buffers/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    const idx = (loc.Buffers || []).findIndex(b => b.Id === req.params.id);
    if (idx !== -1) { loc.Buffers.splice(idx, 1); writeDb(db); return res.status(204).end(); }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Supply Contracts (under AllocationPoints) ─────────────────
app.post('/api/allocationpoints/:apId/contracts', (req, res) => {
  const db = readDb();
  const result = findAllocationPoint(db, req.params.apId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const sc = {
    Id: newId('sc'), Kind: req.body.Kind || result.connKind,
    Name: req.body.Name || 'Nieuw leveringscontract', Description: req.body.Description || '',
    Limit: 0, Price: 0, ExemptionPrice: 0,
    LimitBuy: 0, LimitSell: 0, LimitBuyYear: 0,
    DateStart: '', DateEnd: '',
    ...pick(req.body, ['Name','Description','Kind','Limit','Price','ExemptionPrice','LimitBuy','LimitSell','LimitBuyYear','DateStart','DateEnd'])
  };
  if (!result.ap.Contracts) result.ap.Contracts = [];
  result.ap.Contracts.push(sc);
  writeDb(db);
  res.status(201).json(sc);
});
app.put('/api/supplycontracts/:id', (req, res) => {
  const db = readDb();
  const result = findSupplyContract(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.sc, pick(req.body, ['Name','Description','Kind','Limit','Price','ExemptionPrice','LimitBuy','LimitSell','LimitBuyYear','DateStart','DateEnd']));
  writeDb(db);
  res.json(result.sc);
});
app.delete('/api/supplycontracts/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const conn of [...(loc.GasConnections || []), ...(loc.ElectricityConnections || [])]) {
      for (const ap of (conn.AllocationPoints || [])) {
        const idx = (ap.Contracts || []).findIndex(c => c.Id === req.params.id);
        if (idx !== -1) { ap.Contracts.splice(idx, 1); writeDb(db); return res.status(204).end(); }
      }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── Asset Schedules ───────────────────────────────────────────
app.post('/api/assets/:assetId/schedules', (req, res) => {
  const db = readDb();
  const result = findAsset(db, req.params.assetId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const s = {
    Id: newId('sch'), Name: req.body.Name || 'Nieuw schema',
    Description: req.body.Description || '', Unit: req.body.Unit || '',
    Priority: req.body.Priority ?? 0, Type: req.body.Type ?? 0,
    DateStart: req.body.DateStart || '', DateEnd: req.body.DateEnd || null,
    ...pick(req.body, ['Name','Description','Unit','Priority','Type','DateStart','DateEnd'])
  };
  if (!result.a.Schedules) result.a.Schedules = [];
  result.a.Schedules.push(s);
  writeDb(db);
  res.status(201).json(s);
});
app.put('/api/schedules/:id', (req, res) => {
  const db = readDb();
  const result = findSchedule(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.s, pick(req.body, ['Name','Description','Unit','Priority','Type','DateStart','DateEnd']));
  writeDb(db);
  res.json(result.s);
});
app.delete('/api/schedules/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gh of (loc.Greenhouses || [])) {
      for (const asset of (gh.Assets || [])) {
        const idx = (asset.Schedules || []).findIndex(s => s.Id === req.params.id);
        if (idx !== -1) { asset.Schedules.splice(idx, 1); writeDb(db); return res.status(204).end(); }
      }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── GasConnections ────────────────────────────────────────────
app.post('/api/locations/:locId/gasconnections', (req, res) => {
  const db = readDb();
  const loc = findLocation(db, req.params.locId);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const gc = {
    Id: newId('gasconn'), Name: req.body.Name || 'Nieuwe gasaansluiting',
    Description: req.body.Description || '', EAN: req.body.EAN || '',
    Capacity: req.body.Capacity || 0, AllocationPoints: [], GridContracts: []
  };
  if (!loc.GasConnections) loc.GasConnections = [];
  loc.GasConnections.push(gc);
  writeDb(db);
  res.status(201).json(gc);
});
app.put('/api/gasconnections/:id', (req, res) => {
  const db = readDb();
  const result = findGasConnection(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.gc, pick(req.body, ['Name','Description','EAN','Capacity']));
  writeDb(db);
  res.json(result.gc);
});
app.delete('/api/gasconnections/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    const idx = (loc.GasConnections || []).findIndex(c => c.Id === req.params.id);
    if (idx !== -1) { loc.GasConnections.splice(idx, 1); writeDb(db); return res.status(204).end(); }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── ElectricityConnections ────────────────────────────────────
app.post('/api/locations/:locId/electricityconnections', (req, res) => {
  const db = readDb();
  const loc = findLocation(db, req.params.locId);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const ec = {
    Id: newId('elecconn'), Name: req.body.Name || 'Nieuwe elektriciteitsaansluiting',
    Description: req.body.Description || '', EAN: req.body.EAN || '',
    Capacity: req.body.Capacity || 0, AllocationPoints: [], GridContracts: []
  };
  if (!loc.ElectricityConnections) loc.ElectricityConnections = [];
  loc.ElectricityConnections.push(ec);
  writeDb(db);
  res.status(201).json(ec);
});
app.put('/api/electricityconnections/:id', (req, res) => {
  const db = readDb();
  const result = findElecConnection(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.ec, pick(req.body, ['Name','Description','EAN','Capacity']));
  writeDb(db);
  res.json(result.ec);
});
app.delete('/api/electricityconnections/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    const idx = (loc.ElectricityConnections || []).findIndex(c => c.Id === req.params.id);
    if (idx !== -1) { loc.ElectricityConnections.splice(idx, 1); writeDb(db); return res.status(204).end(); }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── AllocationPoints ──────────────────────────────────────────
app.post('/api/gasconnections/:connId/allocationpoints', (req, res) => {
  const db = readDb();
  const result = findGasConnection(db, req.params.connId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const ap = {
    Id: newId('ap'), Name: req.body.Name || 'Nieuw allocatiepunt',
    Description: req.body.Description || '', Direction: req.body.Direction || 'Consume',
    Capacity: req.body.Capacity || 0, AssetIds: req.body.AssetIds || [], Contracts: []
  };
  if (!result.gc.AllocationPoints) result.gc.AllocationPoints = [];
  result.gc.AllocationPoints.push(ap);
  writeDb(db);
  res.status(201).json(ap);
});
app.post('/api/electricityconnections/:connId/allocationpoints', (req, res) => {
  const db = readDb();
  const result = findElecConnection(db, req.params.connId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const ap = {
    Id: newId('ap'), Name: req.body.Name || 'Nieuw allocatiepunt',
    Description: req.body.Description || '', Direction: req.body.Direction || 'Consume',
    Capacity: req.body.Capacity || 0, AssetIds: req.body.AssetIds || [], Contracts: []
  };
  if (!result.ec.AllocationPoints) result.ec.AllocationPoints = [];
  result.ec.AllocationPoints.push(ap);
  writeDb(db);
  res.status(201).json(ap);
});
app.put('/api/allocationpoints/:id', (req, res) => {
  const db = readDb();
  const result = findAllocationPoint(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.ap, pick(req.body, ['Name','Description','Direction','Capacity','AssetIds']));
  writeDb(db);
  res.json(result.ap);
});
app.delete('/api/allocationpoints/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gc of (loc.GasConnections || [])) {
      const idx = (gc.AllocationPoints || []).findIndex(a => a.Id === req.params.id);
      if (idx !== -1) { gc.AllocationPoints.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
    for (const ec of (loc.ElectricityConnections || [])) {
      const idx = (ec.AllocationPoints || []).findIndex(a => a.Id === req.params.id);
      if (idx !== -1) { ec.AllocationPoints.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── GasGridContracts ──────────────────────────────────────────
app.post('/api/gasconnections/:connId/gasgridcontracts', (req, res) => {
  const db = readDb();
  const result = findGasConnection(db, req.params.connId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const ggc = {
    Id: newId('ggc'), Name: req.body.Name || 'Nieuw netkostencontract',
    Description: req.body.Description || '',
    ContractCapacity: req.body.ContractCapacity || 0,
    ContractCapacityPrice: req.body.ContractCapacityPrice || 0,
    ExemptionPrice: req.body.ExemptionPrice || 0,
    BoilerTaxPrice: req.body.BoilerTaxPrice || 0,
    DateStart: req.body.DateStart || '', DateEnd: req.body.DateEnd || ''
  };
  if (!result.gc.GridContracts) result.gc.GridContracts = [];
  result.gc.GridContracts.push(ggc);
  writeDb(db);
  res.status(201).json(ggc);
});
app.put('/api/gasgridcontracts/:id', (req, res) => {
  const db = readDb();
  const result = findGasGridContract(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.ggc, pick(req.body, ['Name','Description','ContractCapacity','ContractCapacityPrice','ExemptionPrice','BoilerTaxPrice','DateStart','DateEnd']));
  writeDb(db);
  res.json(result.ggc);
});
app.delete('/api/gasgridcontracts/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const gc of (loc.GasConnections || [])) {
      const idx = (gc.GridContracts || []).findIndex(c => c.Id === req.params.id);
      if (idx !== -1) { gc.GridContracts.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ── ElectricityGridContracts ──────────────────────────────────
app.post('/api/electricityconnections/:connId/electricitygridcontracts', (req, res) => {
  const db = readDb();
  const result = findElecConnection(db, req.params.connId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const egc = {
    Id: newId('egc'), Name: req.body.Name || 'Nieuw netkostencontract',
    Description: req.body.Description || '',
    YearPeak: req.body.YearPeak || 0,
    YearPeakPrice: req.body.YearPeakPrice || 0,
    MonthPeak: req.body.MonthPeak || 0,
    MonthPeakPrice: req.body.MonthPeakPrice || 0,
    FictiveImportPrice: req.body.FictiveImportPrice || 0,
    DateStart: req.body.DateStart || '', DateEnd: req.body.DateEnd || ''
  };
  if (!result.ec.GridContracts) result.ec.GridContracts = [];
  result.ec.GridContracts.push(egc);
  writeDb(db);
  res.status(201).json(egc);
});
app.put('/api/electricitygridcontracts/:id', (req, res) => {
  const db = readDb();
  const result = findElecGridContract(db, req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  Object.assign(result.egc, pick(req.body, ['Name','Description','YearPeak','YearPeakPrice','MonthPeak','MonthPeakPrice','FictiveImportPrice','DateStart','DateEnd']));
  writeDb(db);
  res.json(result.egc);
});
app.delete('/api/electricitygridcontracts/:id', (req, res) => {
  const db = readDb();
  for (const loc of db.locations) {
    for (const ec of (loc.ElectricityConnections || [])) {
      const idx = (ec.GridContracts || []).findIndex(c => c.Id === req.params.id);
      if (idx !== -1) { ec.GridContracts.splice(idx, 1); writeDb(db); return res.status(204).end(); }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CMS API running on http://localhost:${PORT}`));
