export const ASSET_KINDS = {
  WKK:          { label: 'WKK',           color: '#b45309', tint: '#fef3c7', short: 'WK' },
  Boiler:       { label: 'Ketel',          color: '#b91c1c', tint: '#fee2e2', short: 'BL' },
  EBoiler:      { label: 'E-Ketel',        color: '#0e7490', tint: '#cffafe', short: 'EB' },
  Solar:        { label: 'Zonnepanelen',   color: '#a16207', tint: '#fef9c3', short: 'PV' },
  CO2Asset:     { label: 'CO2',            color: '#15803d', tint: '#dcfce7', short: 'C2' },
  HeatNetwork:  { label: 'Warmtenet',      color: '#9333ea', tint: '#f3e8ff', short: 'HN' },
  Battery:      { label: 'Batterij',       color: '#1d4ed8', tint: '#dbeafe', short: 'BA' },
  HeatPump:     { label: 'Warmtepomp',     color: '#0369a1', tint: '#e0f2fe', short: 'WP' },
  HeatStorage:  { label: 'Warmteopslag',   color: '#7c3aed', tint: '#ede9fe', short: 'WO' },
  GasLoad:      { label: 'Gasbelasting',   color: '#92400e', tint: '#fef3c7', short: 'GL' },
  OperatingLoad:{ label: 'Bedrijfsbel.',   color: '#374151', tint: '#f3f4f6', short: 'OL' },
  Lighting:     { label: 'Belichting',     color: '#d97706', tint: '#fffbeb', short: 'LT' },
};

export const BUFFER_KINDS = {
  Heat: { label: 'Warmtebuffer', color: '#b91c1c', tint: '#fee2e2', short: 'HB', unit: 'm3', icon: 'T' },
  CO2:  { label: 'CO2-buffer',   color: '#15803d', tint: '#dcfce7', short: 'C2', unit: 'm3', icon: 'C' },
};

export const ASSET_BUFFER_FLOW = {
  WKK: 'heat', Boiler: 'heat', EBoiler: 'heat', HeatNetwork: 'heat', CO2Asset: 'co2',
};

export const NL = {
  Relation: 'Relatie', Location: 'Locatie', Greenhouse: 'Kas', Cultivation: 'Teelt',
  Asset: 'Asset', Buffer: 'Buffer', CapacityProfile: 'Capaciteitsprofiel',
  Schedule: 'Schema', GasContract: 'Gascontract', ElectricityContract: 'Elektriciteitscontract',
  Name: 'Naam', Description: 'Omschrijving', PublicId: 'Publiek ID', Id: 'ID',
  DateStart: 'Startdatum', DateEnd: 'Einddatum', InternalName: 'Interne naam',
  PlanName: 'Plannaam', DNOName: 'Netbeheerder', DNOCustomerId: 'Klantnummer netbeheerder',
  RelationId: 'Relatie', AddressLine: 'Adresregel', PostalCode: 'Postcode', City: 'Stad',
  ShortName: 'Korte naam', SquareMeters: 'Oppervlakte (m2)', MaximumElectricityUsage: 'Max. elektriciteitsverbruik (kWe)',
  LetsGrowItemId: 'LetsGrow item ID', Lit: 'Belichting', BMEXSectionId: 'BMEX sectie ID',
  ElectricityProduction: 'Elektriciteitsproductie', HeatProduction: 'Warmteproductie',
  CO2Production: 'CO2-productie', GasUsage: 'Gasverbruik', ElectricityUsage: 'Elektriciteitsverbruik',
  Efficiency: 'Rendement', ElectricCapacity: 'Elektrische capaciteit',
  MaximalCharge: 'Max. belasting', MinimalCharge: 'Min. belasting',
  BidComponentId: 'Biedcomponent ID', UreumLoad: 'Ureumbelasting',
  ReservePowerUpBidComponentId: 'Regelvermogen opwaarts',
  ReservePowerDownBidComponentId: 'Regelvermogen neerwaarts',
  Volume: 'Volume', MinTemperature: 'Min. temperatuur', MaxTemperature: 'Max. temperatuur',
  MaxPressure: 'Max. druk', Kind: 'Type', EANCode: 'EAN-code', Price: 'Prijs', Limit: 'Limiet',
  LimitBuy: 'Inkooplimiet', LimitSell: 'Verkooplimiet', LimitBuyYear: 'Jaarlijks inkooplimiet',
  GasConnection: 'Gasaansluiting', ElectricityConnection: 'Elektriciteitsaansluiting',
  AllocationPoint: 'Allocatiepunt', Direction: 'Richting', EAN: 'EAN-code', Capacity: 'Capaciteit',
  GasGridContract: 'Gas netkostencontract', ElectricityGridContract: 'Elektriciteit netkostencontract',
  ContractCapacity: 'Contractcapaciteit', ContractCapacityPrice: 'Prijs contractcapaciteit',
  BoilerTaxPrice: 'Ketelbelastingprijs', ExemptionPrice: 'Vrijstellingsprijs',
  YearPeak: 'Jaarpiek', YearPeakPrice: 'Prijs jaarpiek',
  MonthPeak: 'Maandpiek', MonthPeakPrice: 'Prijs maandpiek',
  FictiveImportPrice: 'Fictieve importprijs', AllocationPointId: 'Allocatiepunt',
};

export function t(key) { return NL[key] || key; }
