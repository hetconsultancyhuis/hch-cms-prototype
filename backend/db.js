'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'cms.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS relations (
    Id          TEXT PRIMARY KEY,
    Name        TEXT NOT NULL DEFAULT '',
    Description TEXT NOT NULL DEFAULT '',
    AddressLine TEXT NOT NULL DEFAULT '',
    PostalCode  TEXT NOT NULL DEFAULT '',
    City        TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS locations (
    Id            TEXT PRIMARY KEY,
    RelationId    TEXT REFERENCES relations(Id),
    PublicId      INTEGER,
    Name          TEXT NOT NULL DEFAULT '',
    InternalName  TEXT NOT NULL DEFAULT '',
    PlanName      TEXT NOT NULL DEFAULT '',
    Description   TEXT NOT NULL DEFAULT '',
    DNOName       TEXT NOT NULL DEFAULT '',
    DNOCustomerId TEXT NOT NULL DEFAULT '',
    AddressLine   TEXT NOT NULL DEFAULT '',
    PostalCode    TEXT NOT NULL DEFAULT '',
    City          TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS greenhouses (
    Id                      TEXT PRIMARY KEY,
    LocationId              TEXT NOT NULL REFERENCES locations(Id) ON DELETE CASCADE,
    Name                    TEXT NOT NULL DEFAULT '',
    ShortName               TEXT NOT NULL DEFAULT '',
    Description             TEXT NOT NULL DEFAULT '',
    SquareMeters            REAL NOT NULL DEFAULT 0,
    MaximumElectricityUsage REAL NOT NULL DEFAULT 0,
    LetsGrowItemId          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cultivations (
    Id                      TEXT PRIMARY KEY,
    GreenhouseId            TEXT NOT NULL REFERENCES greenhouses(Id) ON DELETE CASCADE,
    Name                    TEXT NOT NULL DEFAULT '',
    Description             TEXT NOT NULL DEFAULT '',
    DateStart               TEXT NOT NULL DEFAULT '',
    DateEnd                 TEXT,
    SquareMeters            REAL NOT NULL DEFAULT 0,
    MaximumElectricityUsage REAL NOT NULL DEFAULT 0,
    Lit                     INTEGER NOT NULL DEFAULT 0,
    PublicId                TEXT NOT NULL DEFAULT '',
    BMEXSectionId           TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS buffers (
    Id             TEXT PRIMARY KEY,
    LocationId     TEXT NOT NULL REFERENCES locations(Id) ON DELETE CASCADE,
    GreenhouseIds  TEXT NOT NULL DEFAULT '[]',
    Kind           TEXT NOT NULL DEFAULT 'Heat',
    Name           TEXT NOT NULL DEFAULT '',
    Description    TEXT NOT NULL DEFAULT '',
    Volume         REAL NOT NULL DEFAULT 0,
    MinTemperature REAL,
    MaxTemperature REAL,
    MaxPressure    REAL
  );

  CREATE TABLE IF NOT EXISTS assets (
    Id                TEXT PRIMARY KEY,
    GreenhouseId      TEXT NOT NULL REFERENCES greenhouses(Id) ON DELETE CASCADE,
    Kind              TEXT NOT NULL DEFAULT 'WKK',
    Name              TEXT NOT NULL DEFAULT '',
    Description       TEXT NOT NULL DEFAULT '',
    BufferId          TEXT,
    AllocationPointId TEXT,
    Extra             TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS capacities (
    Id                            TEXT PRIMARY KEY,
    AssetId                       TEXT NOT NULL REFERENCES assets(Id) ON DELETE CASCADE,
    Name                          TEXT NOT NULL DEFAULT '',
    Description                   TEXT NOT NULL DEFAULT '',
    DateStart                     TEXT NOT NULL DEFAULT '',
    DateEnd                       TEXT,
    ElectricityProduction         REAL NOT NULL DEFAULT 0,
    HeatProduction                REAL NOT NULL DEFAULT 0,
    CO2Production                 REAL NOT NULL DEFAULT 0,
    GasUsage                      REAL NOT NULL DEFAULT 0,
    ElectricityUsage              REAL NOT NULL DEFAULT 0,
    Efficiency                    REAL NOT NULL DEFAULT 0,
    ElectricCapacity              REAL NOT NULL DEFAULT 0,
    MaximalCharge                 REAL NOT NULL DEFAULT 0,
    MinimalCharge                 REAL NOT NULL DEFAULT 0,
    UreumLoad                     REAL,
    BidComponentId                TEXT NOT NULL DEFAULT '',
    ReservePowerUpBidComponentId  TEXT NOT NULL DEFAULT '',
    ReservePowerDownBidComponentId TEXT NOT NULL DEFAULT '',
    CatalogCO2Production          REAL,
    CatalogElectricityConsumption REAL,
    CatalogElectricityProduction  REAL,
    CatalogGasUsage               REAL,
    CatalogHeatProduction         REAL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    Id          TEXT PRIMARY KEY,
    AssetId     TEXT NOT NULL REFERENCES assets(Id) ON DELETE CASCADE,
    Name        TEXT NOT NULL DEFAULT '',
    Description TEXT NOT NULL DEFAULT '',
    Unit        TEXT NOT NULL DEFAULT '',
    Priority    INTEGER NOT NULL DEFAULT 0,
    Type        INTEGER NOT NULL DEFAULT 0,
    DateStart   TEXT NOT NULL DEFAULT '',
    DateEnd     TEXT
  );

  CREATE TABLE IF NOT EXISTS gas_supplies (
    Id              TEXT PRIMARY KEY,
    GreenhouseId    TEXT NOT NULL UNIQUE REFERENCES greenhouses(Id) ON DELETE CASCADE,
    EANCode         TEXT NOT NULL DEFAULT '',
    DNOConnectionId TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS electricity_supplies (
    Id              TEXT PRIMARY KEY,
    GreenhouseId    TEXT NOT NULL UNIQUE REFERENCES greenhouses(Id) ON DELETE CASCADE,
    EANCode         TEXT NOT NULL DEFAULT '',
    DNOConnectionId TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS supply_contracts (
    Id              TEXT PRIMARY KEY,
    AllocationPointId TEXT NOT NULL REFERENCES allocation_points(Id) ON DELETE CASCADE,
    Kind            TEXT NOT NULL DEFAULT 'gas' CHECK(Kind IN ('gas', 'elec')),
    Name            TEXT NOT NULL DEFAULT '',
    Description     TEXT NOT NULL DEFAULT '',
    DateStart       TEXT NOT NULL DEFAULT '',
    DateEnd         TEXT NOT NULL DEFAULT '',
    Limit           REAL NOT NULL DEFAULT 0,
    Price           REAL NOT NULL DEFAULT 0,
    ExemptionPrice  REAL NOT NULL DEFAULT 0,
    LimitBuy        REAL NOT NULL DEFAULT 0,
    LimitSell       REAL NOT NULL DEFAULT 0,
    LimitBuyYear    REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gas_connections (
    Id          TEXT PRIMARY KEY,
    LocationId  TEXT NOT NULL REFERENCES locations(Id) ON DELETE CASCADE,
    Name        TEXT NOT NULL DEFAULT '',
    Description TEXT NOT NULL DEFAULT '',
    EAN         TEXT NOT NULL DEFAULT '',
    Capacity    REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS electricity_connections (
    Id          TEXT PRIMARY KEY,
    LocationId  TEXT NOT NULL REFERENCES locations(Id) ON DELETE CASCADE,
    Name        TEXT NOT NULL DEFAULT '',
    Description TEXT NOT NULL DEFAULT '',
    EAN         TEXT NOT NULL DEFAULT '',
    Capacity    REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS allocation_points (
    Id             TEXT PRIMARY KEY,
    ConnectionId   TEXT NOT NULL,
    ConnectionKind TEXT NOT NULL CHECK(ConnectionKind IN ('gas', 'elec')),
    Name           TEXT NOT NULL DEFAULT '',
    Description    TEXT NOT NULL DEFAULT '',
    Direction      TEXT NOT NULL DEFAULT 'Consume',
    Capacity       REAL NOT NULL DEFAULT 0,
    AssetIds       TEXT NOT NULL DEFAULT '[]'
  );
`);

try { db.exec('ALTER TABLE assets ADD COLUMN AllocationPointId TEXT'); } catch {}

module.exports = db;
