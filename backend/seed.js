'use strict';
const db = require('./db');
const fs = require('fs');
const path = require('path');

const count = db.prepare('SELECT COUNT(*) AS n FROM relations').get().n;
if (count > 0) {
  console.log('Database already seeded — skipping.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

// Collect all defined buffer IDs so orphaned BufferIds become null
const knownBufferIds = new Set();
for (const loc of data.locations || []) {
  for (const gh of loc.Greenhouses || []) {
    for (const buf of gh.Buffers || []) knownBufferIds.add(buf.Id);
  }
}

const seed = db.transaction(() => {
  // Disable FK checks for bulk import (orphaned BufferIds exist in the source data)
  db.pragma('foreign_keys = OFF');

  for (const rel of data.relations || []) {
    db.prepare('INSERT INTO relations VALUES (?,?,?,?,?,?)').run(
      rel.Id, rel.Name, rel.Description || '',
      rel.Address?.AddressLine || '', rel.Address?.PostalCode || '', rel.Address?.City || ''
    );
  }

  for (const loc of data.locations || []) {
    db.prepare('INSERT INTO locations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      loc.Id, loc.RelationId || null, loc.PublicId || null,
      loc.Name, loc.InternalName || '', loc.PlanName || '',
      loc.Description || '', loc.DNOName || '', loc.DNOCustomerId || '',
      loc.Address?.AddressLine || '', loc.Address?.PostalCode || '', loc.Address?.City || ''
    );

    for (const gc of loc.GasConnections || []) {
      db.prepare('INSERT INTO gas_connections VALUES (?,?,?,?,?,?)').run(
        gc.Id, loc.Id, gc.Name, gc.Description || '', gc.EAN || '', gc.Capacity || 0
      );
      for (const ap of gc.AllocationPoints || []) {
        db.prepare('INSERT INTO allocation_points VALUES (?,?,?,?,?,?,?,?)').run(
          ap.Id, gc.Id, 'gas', ap.Name, ap.Description || '',
          ap.Direction || 'Consume', ap.Capacity || 0, JSON.stringify(ap.AssetIds || [])
        );
      }
    }

    for (const ec of loc.ElectricityConnections || []) {
      db.prepare('INSERT INTO electricity_connections VALUES (?,?,?,?,?,?)').run(
        ec.Id, loc.Id, ec.Name, ec.Description || '', ec.EAN || '', ec.Capacity || 0
      );
      for (const ap of ec.AllocationPoints || []) {
        db.prepare('INSERT INTO allocation_points VALUES (?,?,?,?,?,?,?,?)').run(
          ap.Id, ec.Id, 'elec', ap.Name, ap.Description || '',
          ap.Direction || 'Consume', ap.Capacity || 0, JSON.stringify(ap.AssetIds || [])
        );
      }
    }

    for (const gh of loc.Greenhouses || []) {
      db.prepare('INSERT INTO greenhouses VALUES (?,?,?,?,?,?,?,?)').run(
        gh.Id, loc.Id, gh.Name, gh.ShortName || '', gh.Description || '',
        gh.SquareMeters || 0, gh.MaximumElectricityUsage || 0, gh.LetsGrowItemId || 0
      );

      for (const buf of gh.Buffers || []) {
        db.prepare('INSERT INTO buffers VALUES (?,?,?,?,?,?,?,?,?)').run(
          buf.Id, gh.Id, buf.Kind || 'Heat', buf.Name, buf.Description || '',
          buf.Volume || 0, buf.MinTemperature ?? null, buf.MaxTemperature ?? null, buf.MaxPressure ?? null
        );
      }

      for (const cult of gh.Cultivations || []) {
        db.prepare('INSERT INTO cultivations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
          cult.Id, gh.Id, cult.Name, cult.Description || '',
          cult.DateStart || '', cult.DateEnd ?? null,
          cult.SquareMeters || 0, cult.MaximumElectricityUsage || 0,
          cult.Lit ? 1 : 0, cult.PublicId || '', cult.BMEXSectionId || ''
        );
      }

      for (const asset of gh.Assets || []) {
        const bufferId = (asset.BufferId && knownBufferIds.has(asset.BufferId)) ? asset.BufferId : null;
        db.prepare('INSERT INTO assets VALUES (?,?,?,?,?,?,?)').run(
          asset.Id, gh.Id, asset.Kind || 'WKK', asset.Name, asset.Description || '',
          bufferId, JSON.stringify(asset.extra || {})
        );

        for (const cp of asset.Capacities || []) {
          db.prepare('INSERT INTO capacities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
            cp.Id, asset.Id, cp.Name, cp.Description || '',
            cp.DateStart || '', cp.DateEnd ?? null,
            cp.ElectricityProduction || 0, cp.HeatProduction || 0,
            cp.CO2Production || 0, cp.GasUsage || 0,
            cp.ElectricityUsage || 0, cp.Efficiency || 0,
            cp.ElectricCapacity || 0, cp.MaximalCharge || 0,
            cp.MinimalCharge || 0, cp.UreumLoad ?? null,
            cp.BidComponentId || '', cp.ReservePowerUpBidComponentId || '',
            cp.ReservePowerDownBidComponentId || '',
            cp.CatalogCO2Production ?? null, cp.CatalogElectricityConsumption ?? null,
            cp.CatalogElectricityProduction ?? null, cp.CatalogGasUsage ?? null,
            cp.CatalogHeatProduction ?? null
          );
        }

        for (const s of asset.Schedules || []) {
          db.prepare('INSERT INTO schedules VALUES (?,?,?,?,?,?,?,?,?)').run(
            s.Id, asset.Id, s.Name, s.Description || '',
            s.Unit || '', s.Priority ?? 0, s.Type ?? 0,
            s.DateStart || '', s.DateEnd ?? null
          );
        }
      }

      if (gh.GasSupply) {
        const gs = gh.GasSupply;
        db.prepare('INSERT INTO gas_supplies VALUES (?,?,?,?)').run(
          gs.Id, gh.Id, gs.EANCode || '', gs.DNOConnectionId || ''
        );
        for (const gc of gs.Contracts || []) {
          db.prepare('INSERT INTO gas_contracts VALUES (?,?,?,?,?,?,?,?,?)').run(
            gc.Id, gs.Id, gc.Name, gc.Description || '',
            gc.Limit || 0, gc.Price || 0, gc.ExemptionPrice || 0,
            gc.DateStart || '', gc.DateEnd || ''
          );
        }
      }

      if (gh.ElectricitySupply) {
        const es = gh.ElectricitySupply;
        db.prepare('INSERT INTO electricity_supplies VALUES (?,?,?,?)').run(
          es.Id, gh.Id, es.EANCode || '', es.DNOConnectionId || ''
        );
        for (const ec of es.Contracts || []) {
          db.prepare('INSERT INTO electricity_contracts VALUES (?,?,?,?,?,?,?,?,?,?)').run(
            ec.Id, es.Id, ec.Name, ec.Description || '',
            ec.LimitBuy || 0, ec.LimitSell || 0, ec.LimitBuyYear || 0,
            ec.Price || 0, ec.DateStart || '', ec.DateEnd || ''
          );
        }
      }
    }
  }

  db.pragma('foreign_keys = ON');
});

seed();
console.log('Seeded cms.db from db.json successfully.');
