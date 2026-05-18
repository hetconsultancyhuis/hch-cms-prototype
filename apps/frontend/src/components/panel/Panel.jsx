import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api';
import { ASSET_KINDS, BUFFER_KINDS, assetKindCfg, t } from '../../constants';
import { ENTITY_REGISTRY } from '../../entities/registry';
import PanelSection from './PanelSection';

// ── Form field helpers ────────────────────────────────────────────────────

function Field({ label, name, value, onChange, type = 'text', unit, readonly, textarea }) {
  const inp = textarea ? (
    <textarea value={value ?? ''} readOnly={readonly} onChange={e => onChange?.(name, e.target.value)} rows={3} />
  ) : unit ? (
    <div className="unit">
      <input type={type} value={value ?? ''} readOnly={readonly} onChange={e => onChange?.(name, e.target.value)} />
      <span>{unit}</span>
    </div>
  ) : (
    <input type={type} value={value ?? ''} readOnly={readonly} onChange={e => onChange?.(name, e.target.value)} />
  );
  return <div className="field"><label>{label}</label>{inp}</div>;
}

function FieldRow({ children }) {
  return <div className="field-row">{children}</div>;
}

function RelatedRow({ color, short, name, sub, onClick }) {
  return (
    <div className="related" onClick={onClick}>
      <span className="icon" style={{ background: color }}>{short}</span>
      <div className="meta">
        <div className="name">{name}</div>
        <div className="sub">{sub}</div>
      </div>
      <span className="sub" style={{ color: 'var(--ink-3)' }}>›</span>
    </div>
  );
}

function BtnNew({ label, onClick }) {
  return <button className="btn-new" onClick={onClick}>＋ {label}</button>;
}

function RelTopBtn({ id, payload, visibleRelations, toggleVisibleRelation }) {
  const on = visibleRelations.has(id);
  return (
    <button className={`rel-top-btn${on ? ' rel-on' : ''}`} onClick={() => toggleVisibleRelation(id, payload)}>
      {on ? '⬤ Verberg relaties' : '○ Toon relaties'}
    </button>
  );
}

// ── Nested field path setter ──────────────────────────────────────────────

function setPath(obj, path, value) {
  const parts = path.split('.');
  if (parts.length === 1) return { ...obj, [path]: value };
  const [head, ...rest] = parts;
  return { ...obj, [head]: setPath(obj[head] || {}, rest.join('.'), value) };
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ?? {})[k], obj);
}

// ── Main Panel component ──────────────────────────────────────────────────

export default function Panel() {
  const app = useApp();
  const {
    selected, setSelected, findHitItem, selectItem, selectDirect,
    locations, locationIdx, setLocationIdx, relations,
    visibleRelations, toggleVisibleRelation,
    currentLocation, loadData, showToast, refId, setModal,
  } = app;

  const [form, setForm] = useState({});
  const [checkedGhs, setCheckedGhs] = useState(new Set());

  const payload = selected?.payload;
  const kind = payload?.kind;

  // Sync form state when selection changes
  useEffect(() => {
    if (!payload?.ref) { setForm({}); setCheckedGhs(new Set()); return; }
    setForm(JSON.parse(JSON.stringify(payload.ref)));
    if (payload.kind === 'buffer') setCheckedGhs(new Set(payload.ref.GreenhouseIds || []));
  }, [selected]);

  function handleChange(path, value) {
    setForm(prev => setPath(prev, path, value === '' ? '' : (!isNaN(value) && value !== '' ? Number(value) : value)));
  }

  function fieldVal(path) { return getPath(form, path) ?? ''; }

  // ── Save / Delete ──────────────────────────────────────────────────────

  async function save() {
    if (!payload) return;
    const reg = ENTITY_REGISTRY[kind];
    if (!reg?.apiUpdate) return;
    try {
      await reg.apiUpdate(payload.ref.Id, form);
      showToast('Opgeslagen');
      await loadData(payload.ref.Id, true);
    } catch (e) { showToast(e.message, true); }
  }

  async function del() {
    if (!payload) return;
    const reg = ENTITY_REGISTRY[kind];
    if (!reg) return;
    if (!window.confirm(`${reg.label} "${payload.ref.Name || payload.ref.Id}" verwijderen?`)) return;
    try {
      await reg.apiDelete(payload.ref.Id);
      setSelected(null);
      showToast('Verwijderd');
      await loadData();
    } catch (e) { showToast(e.message, true); }
  }

  // ── Create helpers ─────────────────────────────────────────────────────

  function showCreateModal(title, fields, onConfirm) {
    setModal({ title, fields, onConfirm });
  }

  function newGreenhouse(locId) {
    showCreateModal('Nieuwe kas', {
      Name: { label: 'Naam' }, ShortName: { label: 'Korte naam' },
      SquareMeters: { label: 'Oppervlakte (m2)', type: 'number' },
    }, async (data) => {
      const gh = await api.createGreenhouse(locId, data);
      showToast('Kas aangemaakt');
      await loadData(null, true);
      const it = findHitItem(i => i.kind === 'greenhouse' && i.ref.Id === gh.Id);
      if (it) selectItem(it);
    });
  }

  function newCultivation(ghId) {
    showCreateModal('Nieuwe teelt', {
      Name: { label: 'Naam' }, DateStart: { label: 'Startdatum', type: 'date' },
      SquareMeters: { label: 'Oppervlakte (m2)', type: 'number' },
    }, async (data) => {
      const cult = await api.createCultivation(ghId, data);
      showToast('Teelt aangemaakt');
      await loadData(null, true);
      selectDirect('cultivation', cult, { gh: payload?.ref, loc: currentLocation });
    });
  }

  function newAsset(ghId) {
    showCreateModal('Nieuw asset', {
      Name: { label: 'Naam' }, Description: { label: 'Beschrijving' },
    }, async (data) => {
      const asset = await api.createAsset(ghId, { ...data, Kind: 'WKK' });
      showToast('Asset aangemaakt');
      await loadData(asset.Id, true);
    });
  }

  function newCapacity(assetId) {
    showCreateModal('Nieuw capaciteitsprofiel', {
      Name: { label: 'Naam' },
    }, async (data) => {
      const cp = await api.createCapacity(assetId, data);
      showToast('Capaciteitsprofiel aangemaakt');
      await loadData(cp.Id, true);
    });
  }

  function newBuffer(locId) {
    showCreateModal('Nieuwe buffer', {
      Name: { label: 'Naam' }, Volume: { label: 'Volume (m3)', type: 'number' },
    }, async (data) => {
      const buf = await api.createBuffer(locId, data);
      showToast('Buffer aangemaakt');
      await loadData(buf.Id, true);
    });
  }

  function newGasConnection(locId) {
    showCreateModal('Nieuwe gasaansluiting', {
      Name: { label: 'Naam' }, EAN: { label: 'EAN-code' },
      Capacity: { label: 'Capaciteit (m3/h)', type: 'number' },
    }, async (data) => {
      const gc = await api.createGasConnection(locId, data);
      showToast('Gasaansluiting aangemaakt');
      await loadData(gc.Id, true);
    });
  }

  function newElecConnection(locId) {
    showCreateModal('Nieuwe elektriciteitsaansluiting', {
      Name: { label: 'Naam' }, EAN: { label: 'EAN-code' },
      Capacity: { label: 'Capaciteit (kWe)', type: 'number' },
    }, async (data) => {
      const ec = await api.createElecConnection(locId, data);
      showToast('Elektriciteitsaansluiting aangemaakt');
      await loadData(ec.Id, true);
    });
  }

  function newAllocationPoint(connId, connKind) {
    showCreateModal('Nieuw allocatiepunt', {
      Name: { label: 'Naam' }, Direction: { label: 'Richting (Consume/Produce)' },
      Capacity: { label: 'Capaciteit', type: 'number' },
    }, async (data) => {
      const ap = connKind === 'gas'
        ? await api.createAllocationPointGas(connId, data)
        : await api.createAllocationPointElec(connId, data);
      showToast('Allocatiepunt aangemaakt');
      await loadData(ap.Id, true);
    });
  }

  function newSupplyContract(apId, connKind) {
    const isGas = connKind === 'gas';
    showCreateModal(`Nieuw ${isGas ? 'gas' : 'elektriciteits'}contract`, {
      Name: { label: 'Naam' },
      Price: { label: `Prijs (${isGas ? '€/m3' : '€/kWh'})`, type: 'number' },
    }, async (data) => {
      const sc = await api.createSupplyContract(apId, { ...data, Kind: connKind });
      showToast('Leveringscontract aangemaakt');
      await loadData(sc.Id, true);
    });
  }

  function newGasGridContract(connId) {
    showCreateModal('Nieuw gas netkostencontract', {
      Name: { label: 'Naam' },
      ContractCapacity: { label: 'Contractcapaciteit (m3/h)', type: 'number' },
    }, async (data) => {
      const ggc = await api.createGasGridContract(connId, data);
      showToast('Gas netkostencontract aangemaakt');
      await loadData(ggc.Id, true);
    });
  }

  function newElecGridContract(connId) {
    showCreateModal('Nieuw elektriciteit netkostencontract', {
      Name: { label: 'Naam' },
      YearPeak: { label: 'Jaarpiek (kWe)', type: 'number' },
    }, async (data) => {
      const egc = await api.createElecGridContract(connId, data);
      showToast('Elektriciteit netkostencontract aangemaakt');
      await loadData(egc.Id, true);
    });
  }

  function navigateToGh(gh) {
    const it = findHitItem(i => i.kind === 'greenhouse' && i.ref === gh);
    it ? selectItem(it) : selectDirect('greenhouse', gh, { loc: currentLocation });
  }

  function navigateToBuf(bf) {
    const it = findHitItem(i => i.kind === 'buffer' && i.ref === bf);
    it ? selectItem(it) : selectDirect('buffer', bf, { loc: currentLocation });
  }

  function navigateToAsset(a, gh) {
    const it = findHitItem(i => i.kind === 'asset' && i.ref === a);
    it ? selectItem(it) : selectDirect('asset', a, { loc: currentLocation, gh });
  }

  // ── Empty state ───────────────────────────────────────────────────────

  if (!selected) {
    return (
      <div className="panel">
        <div className="empty">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="14" y="14" width="52" height="52" rx="8" stroke="#94a3b8" strokeWidth="1.5"/>
            <rect x="22" y="24" width="36" height="2" rx="1" fill="#94a3b8"/>
            <rect x="22" y="32" width="22" height="2" rx="1" fill="#94a3b8"/>
            <rect x="22" y="40" width="36" height="2" rx="1" fill="#94a3b8"/>
            <rect x="22" y="48" width="14" height="2" rx="1" fill="#94a3b8"/>
          </svg>
          <div>Geen selectie</div>
          <div className="hint">
            Klik op een element om de eigenschappen te bewerken. Sleep om te pannen, scroll om te zoomen,{' '}
            <span className="kbd">F</span> om in te passen.
          </div>
        </div>
      </div>
    );
  }

  // ── Head / foot ────────────────────────────────────────────────────────

  function Head({ kind: k, title, desc }) {
    return (
      <div className="panel-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pill">{k}</div>
          <h2>{title}</h2>
          {desc && <div className="desc">{desc}</div>}
        </div>
        <button className="btn" onClick={() => setSelected(null)}>✕</button>
      </div>
    );
  }

  function Foot({ id }) {
    return (
      <div className="panel-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
        <span className="meta">Id {id || '—'}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn danger" onClick={del}>Verwijderen</button>
          <button className="btn" onClick={() => setSelected(null)}>Annuleren</button>
          <button className="btn primary" onClick={save}>Opslaan</button>
        </div>
      </div>
    );
  }

  const loc = currentLocation;
  const ref = payload?.ref;
  const parents = payload?.parents || {};

  // ── Entity forms ───────────────────────────────────────────────────────

  if (kind === 'relation') {
    const relLocs = locations.filter(l => l.RelationId === ref.Id);
    return (
      <div className="panel">
        <Head kind="Relatie" title={ref.Name} desc={ref.Description} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Adres">
            <Field label={t('AddressLine')} name="Address.AddressLine" value={fieldVal('Address.AddressLine')} onChange={handleChange} />
            <FieldRow>
              <Field label={t('PostalCode')} name="Address.PostalCode" value={fieldVal('Address.PostalCode')} onChange={handleChange} />
              <Field label={t('City')} name="Address.City" value={fieldVal('Address.City')} onChange={handleChange} />
            </FieldRow>
          </PanelSection>
          <PanelSection title={`Locaties · ${relLocs.length}`}>
            {relLocs.map(l => (
              <RelatedRow key={l.Id} color="#0f172a" short="LC" name={l.Name} sub={`${(l.Greenhouses || []).length} kassen`}
                onClick={() => {
                  const idx = locations.indexOf(l);
                  setLocationIdx(idx);
                  selectItem(findHitItem(it => it.kind === 'location') || null);
                }} />
            ))}
          </PanelSection>
        </div>
        <Foot id={ref.Id} />
      </div>
    );
  }

  if (kind === 'location') {
    const rel = relations.find(r => r.Id === ref.RelationId);
    return (
      <div className="panel">
        <Head kind="Locatie" title={ref.Name} desc={ref.Description} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label="Interne naam" name="InternalName" value={fieldVal('InternalName')} onChange={handleChange} />
            <Field label="Plannaam" name="PlanName" value={fieldVal('PlanName')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Identificatie">
            <FieldRow>
              <Field label={t('PublicId')} name="PublicId" value={fieldVal('PublicId')} readonly />
              <Field label={t('Id')} name="Id" value={fieldVal('Id')} readonly />
            </FieldRow>
            <Field label="Relatie" value={rel?.Name || '—'} readonly />
          </PanelSection>
          <PanelSection title="Netbeheerder">
            <FieldRow>
              <Field label={t('DNOName')} name="DNOName" value={fieldVal('DNOName')} onChange={handleChange} />
              <Field label={t('DNOCustomerId')} name="DNOCustomerId" value={fieldVal('DNOCustomerId')} onChange={handleChange} />
            </FieldRow>
          </PanelSection>
          <PanelSection title="Adres">
            <Field label={t('AddressLine')} name="AddressLine" value={fieldVal('AddressLine')} onChange={handleChange} />
            <FieldRow>
              <Field label={t('PostalCode')} name="PostalCode" value={fieldVal('PostalCode')} onChange={handleChange} />
              <Field label={t('City')} name="City" value={fieldVal('City')} onChange={handleChange} />
            </FieldRow>
          </PanelSection>
          <PanelSection title={`Kassen · ${(ref.Greenhouses || []).length}`}>
            {(ref.Greenhouses || []).map(gh => (
              <RelatedRow key={gh.Id} color="#0e7490" short="KS" name={gh.Name}
                sub={`${Number(gh.SquareMeters || 0).toLocaleString('nl-NL')} m2 · ${(gh.Cultivations || []).length} teelten · ${(gh.Assets || []).length} assets`}
                onClick={() => navigateToGh(gh)} />
            ))}
            <BtnNew label="Nieuwe kas" onClick={() => newGreenhouse(ref.Id)} />
          </PanelSection>
          <PanelSection title={`Buffers · ${(ref.Buffers || []).length}`}>
            {(ref.Buffers || []).map(bf => {
              const cfg = BUFFER_KINDS[bf.Kind] || BUFFER_KINDS.Heat;
              return <RelatedRow key={bf.Id} color={cfg.color} short={cfg.short} name={bf.Name}
                sub={`${cfg.label} · ${Number(bf.Volume || 0).toLocaleString('nl-NL')} m3`}
                onClick={() => navigateToBuf(bf)} />;
            })}
            <BtnNew label="Nieuwe buffer" onClick={() => newBuffer(ref.Id)} />
          </PanelSection>
          <PanelSection title={`Gasaansluitingen · ${(ref.GasConnections || []).length}`}>
            {(ref.GasConnections || []).map(gc => (
              <RelatedRow key={gc.Id} color="#b45309" short="GAS" name={gc.Name}
                sub={`EAN ${gc.EAN || '—'} · ${(gc.AllocationPoints || []).length} AP`}
                onClick={() => { const it = findHitItem(i => i.kind === 'gasconn' && i.ref === gc); it ? selectItem(it) : selectDirect('gasconn', gc, { loc: ref }); }} />
            ))}
            <BtnNew label="Nieuwe gasaansluiting" onClick={() => newGasConnection(ref.Id)} />
          </PanelSection>
          <PanelSection title={`Elektriciteitsaansluitingen · ${(ref.ElectricityConnections || []).length}`}>
            {(ref.ElectricityConnections || []).map(ec => (
              <RelatedRow key={ec.Id} color="#1d4ed8" short="ELE" name={ec.Name}
                sub={`EAN ${ec.EAN || '—'} · ${(ec.AllocationPoints || []).length} AP`}
                onClick={() => { const it = findHitItem(i => i.kind === 'elecconn' && i.ref === ec); it ? selectItem(it) : selectDirect('elecconn', ec, { loc: ref }); }} />
            ))}
            <BtnNew label="Nieuwe elektriciteitsaansluiting" onClick={() => newElecConnection(ref.Id)} />
          </PanelSection>
        </div>
        <Foot id={ref.Id} />
      </div>
    );
  }

  if (kind === 'greenhouse') {
    const gh = ref;
    const ghLoc = parents.loc || loc;
    const linkedBufs = (ghLoc?.Buffers || []).filter(b => (b.GreenhouseIds || []).includes(gh.Id));
    return (
      <div className="panel">
        <Head kind="Kas" title={gh.Name} desc={gh.Description} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('ShortName')} name="ShortName" value={fieldVal('ShortName')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Technisch">
            <FieldRow>
              <Field label="Oppervlakte" name="SquareMeters" value={fieldVal('SquareMeters')} onChange={handleChange} unit="m2" />
              <Field label="Max. elektriciteit" name="MaximumElectricityUsage" value={fieldVal('MaximumElectricityUsage')} onChange={handleChange} unit="kWe" />
            </FieldRow>
            <Field label="LetsGrow item ID" name="LetsGrowItemId" value={fieldVal('LetsGrowItemId')} onChange={handleChange} />
          </PanelSection>
          <PanelSection title={`Teelten · ${(gh.Cultivations || []).length}`}>
            {(gh.Cultivations || []).map(c => (
              <RelatedRow key={c.Id} color="#15803d" short="TL" name={c.Name}
                sub={`${c.DateStart || '?'} – ${c.DateEnd || '∞'} · ${Number(c.SquareMeters || 0).toLocaleString('nl-NL')} m2`}
                onClick={() => selectDirect('cultivation', c, { gh, loc: ghLoc })} />
            ))}
            <BtnNew label="Nieuwe teelt" onClick={() => newCultivation(gh.Id)} />
          </PanelSection>
          <PanelSection title={`Assets · ${(gh.Assets || []).length}`}>
            {(gh.Assets || []).map(a => {
              const cfg = assetKindCfg(a);
              return <RelatedRow key={a.Id} color={cfg.color} short={cfg.short} name={a.Name} sub={cfg.label}
                onClick={() => navigateToAsset(a, gh)} />;
            })}
            <BtnNew label="Nieuw asset" onClick={() => newAsset(gh.Id)} />
          </PanelSection>
          <PanelSection title={`Gekoppelde buffers · ${linkedBufs.length}`}>
            {linkedBufs.map(bf => {
              const cfg = BUFFER_KINDS[bf.Kind] || BUFFER_KINDS.Heat;
              return <RelatedRow key={bf.Id} color={cfg.color} short={cfg.short} name={bf.Name}
                sub={`${cfg.label} · ${Number(bf.Volume || 0).toLocaleString('nl-NL')} m3`}
                onClick={() => navigateToBuf(bf)} />;
            })}
          </PanelSection>
        </div>
        <Foot id={gh.Id} />
      </div>
    );
  }

  if (kind === 'cultivation') {
    const c = ref; const gh = parents.gh;
    return (
      <div className="panel">
        <Head kind="Teelt" title={c.Name} desc={`Kas: ${gh?.Name || ''}`} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
            <Field label={t('PublicId')} name="PublicId" value={fieldVal('PublicId')} onChange={handleChange} />
          </PanelSection>
          <PanelSection title="Teelt details">
            <FieldRow>
              <Field label="Oppervlakte" name="SquareMeters" value={fieldVal('SquareMeters')} onChange={handleChange} unit="m2" />
              <Field label="Max. elektriciteit" name="MaximumElectricityUsage" value={fieldVal('MaximumElectricityUsage')} onChange={handleChange} unit="kWe" />
            </FieldRow>
            <FieldRow>
              <Field label={t('DateStart')} name="DateStart" value={fieldVal('DateStart')} onChange={handleChange} type="date" />
              <Field label={t('DateEnd')} name="DateEnd" value={fieldVal('DateEnd')} onChange={handleChange} type="date" />
            </FieldRow>
            <div className="field">
              <label>{t('Lit')}</label>
              <select value={String(fieldVal('Lit'))} onChange={e => handleChange('Lit', e.target.value === 'true')}>
                <option value="true">Belicht</option>
                <option value="false">Onbelicht</option>
              </select>
            </div>
            <Field label={t('BMEXSectionId')} name="BMEXSectionId" value={fieldVal('BMEXSectionId')} onChange={handleChange} />
          </PanelSection>
        </div>
        <Foot id={c.Id} />
      </div>
    );
  }

  if (kind === 'asset') {
    const a = ref;
    const cfg = assetKindCfg(a);
    const assetLoc = parents.loc || loc;
    const ex = a.extra || {};
    return (
      <div className="panel">
        <Head kind={`${cfg.label} · Asset`} title={a.Name} desc={a.Description} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
            <div className="field">
              <label>{t('Kind')}</label>
              <select value={fieldVal('Kind')} onChange={e => handleChange('Kind', e.target.value)}>
                {Object.entries(ASSET_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Buffer</label>
              <select value={fieldVal('BufferId') || ''} onChange={e => handleChange('BufferId', e.target.value || null)}>
                <option value="">— geen buffer</option>
                {(assetLoc?.Buffers || []).map(bf => <option key={bf.Id} value={bf.Id}>{bf.Name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('AllocationPointId')}</label>
              <select value={fieldVal('AllocationPointId') || ''} onChange={e => handleChange('AllocationPointId', e.target.value || null)}>
                <option value="">— geen allocatiepunt</option>
                {[...(assetLoc?.GasConnections || []), ...(assetLoc?.ElectricityConnections || [])].flatMap(conn =>
                  (conn.AllocationPoints || []).map(ap => (
                    <option key={ap.Id} value={ap.Id}>{conn.Name} · {ap.Name}</option>
                  ))
                )}
              </select>
            </div>
          </PanelSection>
          {Object.keys(ex).length > 0 && (
            <PanelSection title={`${cfg.label} — specifiek`}>
              {Object.entries(ex).map(([k, v]) => (
                <Field key={k} label={t(k) || k} name={`extra.${k}`} value={fieldVal(`extra.${k}`)} onChange={handleChange} />
              ))}
            </PanelSection>
          )}
          <PanelSection title={`Capaciteitsprofielen · ${(a.Capacities || []).length}`}>
            {(a.Capacities || []).map(cp => (
              <RelatedRow key={cp.Id} color="#475569" short="CP" name={cp.Name}
                sub={`E ${cp.ElectricityProduction || 0} · H ${cp.HeatProduction || 0} · CO2 ${cp.CO2Production || 0}`}
                onClick={() => {
                  const it = findHitItem(i => i.kind === 'capacity' && i.ref === cp);
                  it ? selectItem(it) : selectDirect('capacity', cp, { loc: assetLoc, gh: parents.gh, asset: a });
                }} />
            ))}
            <BtnNew label="Nieuw capaciteitsprofiel" onClick={() => newCapacity(a.Id)} />
          </PanelSection>
        </div>
        <Foot id={a.Id} />
      </div>
    );
  }

  if (kind === 'capacity') {
    const c = ref;
    return (
      <div className="panel">
        <Head kind="Capaciteitsprofiel" title={c.Name} desc={`Asset: ${parents.asset?.Name || ''}`} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Productie / verbruik (per uur)">
            <FieldRow>
              <Field label={t('ElectricityProduction')} name="ElectricityProduction" value={fieldVal('ElectricityProduction')} onChange={handleChange} unit="kWe" />
              <Field label={t('HeatProduction')} name="HeatProduction" value={fieldVal('HeatProduction')} onChange={handleChange} unit="kWth" />
            </FieldRow>
            <FieldRow>
              <Field label={t('GasUsage')} name="GasUsage" value={fieldVal('GasUsage')} onChange={handleChange} unit="m3/h" />
              <Field label={t('CO2Production')} name="CO2Production" value={fieldVal('CO2Production')} onChange={handleChange} unit="kg/h" />
            </FieldRow>
            <FieldRow>
              <Field label={t('ElectricityUsage')} name="ElectricityUsage" value={fieldVal('ElectricityUsage')} onChange={handleChange} unit="kWe" />
              <Field label={t('Efficiency')} name="Efficiency" value={fieldVal('Efficiency')} onChange={handleChange} unit="n" />
            </FieldRow>
          </PanelSection>
          <PanelSection title="Vermogen">
            <FieldRow>
              <Field label={t('ElectricCapacity')} name="ElectricCapacity" value={fieldVal('ElectricCapacity')} onChange={handleChange} unit="kWe" />
              <Field label={t('MaximalCharge')} name="MaximalCharge" value={fieldVal('MaximalCharge')} onChange={handleChange} unit="kWe" />
            </FieldRow>
            <FieldRow>
              <Field label={t('MinimalCharge')} name="MinimalCharge" value={fieldVal('MinimalCharge')} onChange={handleChange} unit="kWe" />
              <Field label={t('UreumLoad')} name="UreumLoad" value={fieldVal('UreumLoad')} onChange={handleChange} />
            </FieldRow>
          </PanelSection>
          <PanelSection title="Geldigheid">
            <FieldRow>
              <Field label={t('DateStart')} name="DateStart" value={fieldVal('DateStart')} onChange={handleChange} type="date" />
              <Field label={t('DateEnd')} name="DateEnd" value={fieldVal('DateEnd')} onChange={handleChange} type="date" />
            </FieldRow>
          </PanelSection>
        </div>
        <Foot id={c.Id} />
      </div>
    );
  }

  if (kind === 'buffer') {
    const bf = ref;
    const cfg = BUFFER_KINDS[bf.Kind] || BUFFER_KINDS.Heat;
    const bufLoc = parents.loc || loc;
    const linkedAssets = (bufLoc?.Greenhouses || []).flatMap(gh => gh.Assets || []).filter(a => a.BufferId === bf.Id);

    const localSave = async () => {
      try {
        await ENTITY_REGISTRY.buffer.apiUpdate(bf.Id, { ...form, GreenhouseIds: [...checkedGhs] });
        showToast('Opgeslagen');
        await loadData(bf.Id, true);
      } catch (e) { showToast(e.message, true); }
    };

    return (
      <div className="panel">
        <Head kind={`Buffer · ${cfg.label}`} title={bf.Name} desc={bf.Description} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
            <div className="field">
              <label>{t('Kind')}</label>
              <select value={fieldVal('Kind')} onChange={e => handleChange('Kind', e.target.value)}>
                <option value="Heat">Warmtebuffer</option>
                <option value="CO2">CO2-buffer</option>
              </select>
            </div>
          </PanelSection>
          <PanelSection title="Inhoud">
            <Field label={t('Volume')} name="Volume" value={fieldVal('Volume')} onChange={handleChange} unit="m3" />
            {bf.Kind === 'Heat' ? (
              <FieldRow>
                <Field label={t('MinTemperature')} name="MinTemperature" value={fieldVal('MinTemperature')} onChange={handleChange} unit="°C" />
                <Field label={t('MaxTemperature')} name="MaxTemperature" value={fieldVal('MaxTemperature')} onChange={handleChange} unit="°C" />
              </FieldRow>
            ) : (
              <Field label={t('MaxPressure')} name="MaxPressure" value={fieldVal('MaxPressure')} onChange={handleChange} unit="bar" />
            )}
          </PanelSection>
          <PanelSection title={`Gekoppelde kassen · ${checkedGhs.size}`}>
            {(bufLoc?.Greenhouses || []).map(gh => (
              <label key={gh.Id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={checkedGhs.has(gh.Id)}
                  onChange={e => setCheckedGhs(prev => { const n = new Set(prev); e.target.checked ? n.add(gh.Id) : n.delete(gh.Id); return n; })} />
                {gh.Name}
              </label>
            ))}
          </PanelSection>
          <PanelSection title={`Aangesloten assets · ${linkedAssets.length}`}>
            {linkedAssets.length ? linkedAssets.map(a => {
              const ac = assetKindCfg(a);
              const gh = (bufLoc?.Greenhouses || []).find(g => (g.Assets || []).some(x => x.Id === a.Id));
              return <RelatedRow key={a.Id} color={ac.color} short={ac.short} name={a.Name} sub={ac.label}
                onClick={() => navigateToAsset(a, gh)} />;
            }) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Geen assets gekoppeld.</div>}
          </PanelSection>
        </div>
        <div className="panel-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <span className="meta">Id {bf.Id || '—'}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button className="btn danger" onClick={del}>Verwijderen</button>
            <button className="btn" onClick={() => setSelected(null)}>Annuleren</button>
            <button className="btn primary" onClick={localSave}>Opslaan</button>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'supplycontract') {
    const c = ref; const conn = parents.conn; const connKind = parents.connKind; const ap = parents.ap;
    const isGas = c.Kind === 'gas';
    return (
      <div className="panel">
        <Head kind="Leveringscontract" title={c.Name} desc={`${conn?.Name} · ${ap?.Name}`} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Tarieven / limieten">
            {isGas ? <>
              <FieldRow>
                <Field label="Prijs" name="Price" value={fieldVal('Price')} onChange={handleChange} unit="€/m3" />
                <Field label={t('ExemptionPrice')} name="ExemptionPrice" value={fieldVal('ExemptionPrice')} onChange={handleChange} unit="€/m3" />
              </FieldRow>
              <Field label={t('Limit')} name="Limit" value={fieldVal('Limit')} onChange={handleChange} unit="m3/h" />
            </> : <>
              <Field label="Prijs" name="Price" value={fieldVal('Price')} onChange={handleChange} unit="€/kWh" />
              <FieldRow>
                <Field label={t('LimitBuy')} name="LimitBuy" value={fieldVal('LimitBuy')} onChange={handleChange} unit="kWe" />
                <Field label={t('LimitSell')} name="LimitSell" value={fieldVal('LimitSell')} onChange={handleChange} unit="kWe" />
              </FieldRow>
              <Field label={t('LimitBuyYear')} name="LimitBuyYear" value={fieldVal('LimitBuyYear')} onChange={handleChange} unit="kWh/jr" />
            </>}
          </PanelSection>
          <PanelSection title="Looptijd">
            <FieldRow>
              <Field label={t('DateStart')} name="DateStart" value={fieldVal('DateStart')} onChange={handleChange} type="date" />
              <Field label={t('DateEnd')} name="DateEnd" value={fieldVal('DateEnd')} onChange={handleChange} type="date" />
            </FieldRow>
          </PanelSection>
        </div>
        <Foot id={c.Id} />
      </div>
    );
  }

  if (kind === 'gasconn') {
    const gc = ref; const connLoc = parents.loc || loc;
    return (
      <div className="panel">
        <Head kind="Gasaansluiting" title={gc.Name} desc={gc.Description} />
        <div className="panel-body">
          <RelTopBtn id={gc.Id} payload={payload} visibleRelations={visibleRelations} toggleVisibleRelation={toggleVisibleRelation} />
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Aansluiting">
            <Field label="EAN-code" name="EAN" value={fieldVal('EAN')} onChange={handleChange} />
            <Field label="Capaciteit" name="Capacity" value={fieldVal('Capacity')} onChange={handleChange} unit="m3/h" />
          </PanelSection>
          <PanelSection title={`Allocatiepunten · ${(gc.AllocationPoints || []).length}`}>
            {(gc.AllocationPoints || []).map(ap => (
              <RelatedRow key={ap.Id} color="#64748b" short="AP" name={ap.Name}
                sub={`${ap.Direction || ''} · ${ap.Capacity || 0} m3/h · ${(ap.AssetIds || []).length} assets`}
                onClick={() => selectDirect('allocationpoint', ap, { conn: gc, connKind: 'gas', loc: connLoc })} />
            ))}
            <BtnNew label="Nieuw allocatiepunt" onClick={() => newAllocationPoint(gc.Id, 'gas')} />
          </PanelSection>
          <PanelSection title={`Gas netkostencontracten · ${(gc.GridContracts || []).length}`}>
            {(gc.GridContracts || []).map(ggc => (
              <RelatedRow key={ggc.Id} color="#92400e" short="GGC" name={ggc.Name}
                sub={`${ggc.ContractCapacity || 0} m3/h · ${ggc.DateStart || '?'}`}
                onClick={() => selectDirect('gasGridContract', ggc, { conn: gc, loc: connLoc })} />
            ))}
            <BtnNew label="Nieuw netkostencontract" onClick={() => newGasGridContract(gc.Id)} />
          </PanelSection>
        </div>
        <Foot id={gc.Id} />
      </div>
    );
  }

  if (kind === 'elecconn') {
    const ec = ref; const connLoc = parents.loc || loc;
    return (
      <div className="panel">
        <Head kind="Elektriciteitsaansluiting" title={ec.Name} desc={ec.Description} />
        <div className="panel-body">
          <RelTopBtn id={ec.Id} payload={payload} visibleRelations={visibleRelations} toggleVisibleRelation={toggleVisibleRelation} />
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Aansluiting">
            <Field label="EAN-code" name="EAN" value={fieldVal('EAN')} onChange={handleChange} />
            <Field label="Capaciteit" name="Capacity" value={fieldVal('Capacity')} onChange={handleChange} unit="kWe" />
          </PanelSection>
          <PanelSection title={`Allocatiepunten · ${(ec.AllocationPoints || []).length}`}>
            {(ec.AllocationPoints || []).map(ap => (
              <RelatedRow key={ap.Id} color="#64748b" short="AP" name={ap.Name}
                sub={`${ap.Direction || ''} · ${ap.Capacity || 0} kWe · ${(ap.AssetIds || []).length} assets`}
                onClick={() => selectDirect('allocationpoint', ap, { conn: ec, connKind: 'elec', loc: connLoc })} />
            ))}
            <BtnNew label="Nieuw allocatiepunt" onClick={() => newAllocationPoint(ec.Id, 'elec')} />
          </PanelSection>
          <PanelSection title={`Elektriciteit netkostencontracten · ${(ec.GridContracts || []).length}`}>
            {(ec.GridContracts || []).map(egc => (
              <RelatedRow key={egc.Id} color="#1d4ed8" short="EGC" name={egc.Name}
                sub={`${egc.YearPeak || 0} kWe jaarpiek · ${egc.DateStart || '?'}`}
                onClick={() => selectDirect('elecGridContract', egc, { conn: ec, loc: connLoc })} />
            ))}
            <BtnNew label="Nieuw netkostencontract" onClick={() => newElecGridContract(ec.Id)} />
          </PanelSection>
        </div>
        <Foot id={ec.Id} />
      </div>
    );
  }

  if (kind === 'allocationpoint') {
    const ap = ref; const conn = parents.conn; const connKind = parents.connKind || 'gas'; const apLoc = parents.loc || loc;
    const unit = connKind === 'gas' ? 'm3/h' : 'kWe';
    const allAssets = (apLoc?.Greenhouses || []).flatMap(gh => gh.Assets || []);

    const apas = ap.AllocationPointAssets || [];
    const linkedAssetIdSet = new Set(apas.map(x => x.AssetId).filter(Boolean));

    const toggleLink = async (assetId) => {
      const isLinked = linkedAssetIdSet.has(assetId);
      try {
        if (isLinked) {
          const apa = apas.find(x => x.AssetId === assetId);
          if (apa?.Id) await api.deleteAllocationPointAsset(apa.Id);
        } else {
          await api.createAllocationPointAsset(ap.Id, assetId);
        }
        showToast(isLinked ? 'Ontkoppeld' : 'Gekoppeld');
        await loadData(null, true);
      } catch (e) { showToast(e.message, true); }
    };

    return (
      <div className="panel">
        <Head kind="Allocatiepunt" title={ap.Name} desc={ap.Description} />
        <div className="panel-body">
          <RelTopBtn id={ap.Id} payload={payload} visibleRelations={visibleRelations} toggleVisibleRelation={toggleVisibleRelation} />
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Details">
            <Field label={t('Direction')} name="Direction" value={fieldVal('Direction')} onChange={handleChange} />
            <Field label={`Capaciteit (${unit})`} name="Capacity" value={fieldVal('Capacity')} onChange={handleChange} unit={unit} />
          </PanelSection>
          <PanelSection title={`Gekoppelde assets · ${linkedAssetIdSet.size}`}>
            {allAssets.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Geen assets in deze locatie.</div>
            )}
            {allAssets.map(a => {
              const ac = assetKindCfg(a);
              const linked = linkedAssetIdSet.has(a.Id);
              const gh = (apLoc?.Greenhouses || []).find(g => (g.Assets || []).some(x => x.Id === a.Id));
              return (
                <label key={a.Id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={linked} onChange={() => toggleLink(a.Id)} />
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 18, borderRadius: 3, background: ac.color,
                    color: '#fff', fontSize: 8, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0,
                  }}>{ac.short}</span>
                  <span style={{ flex: 1 }}>{a.Name}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{gh?.Name || ''}</span>
                </label>
              );
            })}
          </PanelSection>
          <PanelSection title={`Leveringscontracten · ${(ap.Contracts || []).length}`}>
            {(ap.Contracts || []).map(sc => {
              const isGas = sc.Kind === 'gas';
              const color = isGas ? '#b45309' : '#1d4ed8';
              return <RelatedRow key={sc.Id} color={color} short={isGas ? 'GAS' : 'ELE'} name={sc.Name}
                sub={`€ ${Number(sc.Price || 0).toFixed(5)}/${isGas ? 'm3' : 'kWh'} · ${sc.DateStart || '?'}`}
                onClick={() => selectDirect('supplycontract', sc, { ap, conn, connKind, loc: apLoc })} />;
            })}
            <BtnNew label="Nieuw leveringscontract" onClick={() => newSupplyContract(ap.Id, connKind)} />
          </PanelSection>
        </div>
        <Foot id={ap.Id} />
      </div>
    );
  }

  if (kind === 'gasGridContract') {
    const ggc = ref; const conn = parents.conn;
    return (
      <div className="panel">
        <Head kind="Gas netkostencontract" title={ggc.Name} desc={conn?.Name} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Capaciteit">
            <FieldRow>
              <Field label={t('ContractCapacity')} name="ContractCapacity" value={fieldVal('ContractCapacity')} onChange={handleChange} unit="m3/h" />
              <Field label={t('ContractCapacityPrice')} name="ContractCapacityPrice" value={fieldVal('ContractCapacityPrice')} onChange={handleChange} unit="€/m3/h" />
            </FieldRow>
            <FieldRow>
              <Field label={t('ExemptionPrice')} name="ExemptionPrice" value={fieldVal('ExemptionPrice')} onChange={handleChange} unit="€/m3" />
              <Field label={t('BoilerTaxPrice')} name="BoilerTaxPrice" value={fieldVal('BoilerTaxPrice')} onChange={handleChange} unit="€/m3" />
            </FieldRow>
          </PanelSection>
          <PanelSection title="Looptijd">
            <FieldRow>
              <Field label={t('DateStart')} name="DateStart" value={fieldVal('DateStart')} onChange={handleChange} type="date" />
              <Field label={t('DateEnd')} name="DateEnd" value={fieldVal('DateEnd')} onChange={handleChange} type="date" />
            </FieldRow>
          </PanelSection>
        </div>
        <Foot id={ggc.Id} />
      </div>
    );
  }

  if (kind === 'elecGridContract') {
    const egc = ref; const conn = parents.conn;
    return (
      <div className="panel">
        <Head kind="Elektriciteit netkostencontract" title={egc.Name} desc={conn?.Name} />
        <div className="panel-body">
          <PanelSection title="Algemeen">
            <Field label={t('Name')} name="Name" value={fieldVal('Name')} onChange={handleChange} />
            <Field label={t('Description')} name="Description" value={fieldVal('Description')} onChange={handleChange} textarea />
          </PanelSection>
          <PanelSection title="Piekbelasting">
            <FieldRow>
              <Field label={t('YearPeak')} name="YearPeak" value={fieldVal('YearPeak')} onChange={handleChange} unit="kWe" />
              <Field label={t('YearPeakPrice')} name="YearPeakPrice" value={fieldVal('YearPeakPrice')} onChange={handleChange} unit="€/kWe" />
            </FieldRow>
            <FieldRow>
              <Field label={t('MonthPeak')} name="MonthPeak" value={fieldVal('MonthPeak')} onChange={handleChange} unit="kWe" />
              <Field label={t('MonthPeakPrice')} name="MonthPeakPrice" value={fieldVal('MonthPeakPrice')} onChange={handleChange} unit="€/kWe" />
            </FieldRow>
            <Field label={t('FictiveImportPrice')} name="FictiveImportPrice" value={fieldVal('FictiveImportPrice')} onChange={handleChange} unit="€/kWh" />
          </PanelSection>
          <PanelSection title="Looptijd">
            <FieldRow>
              <Field label={t('DateStart')} name="DateStart" value={fieldVal('DateStart')} onChange={handleChange} type="date" />
              <Field label={t('DateEnd')} name="DateEnd" value={fieldVal('DateEnd')} onChange={handleChange} type="date" />
            </FieldRow>
          </PanelSection>
        </div>
        <Foot id={egc.Id} />
      </div>
    );
  }

  return <div className="panel"><div className="empty">Onbekend type: {kind}</div></div>;
}
