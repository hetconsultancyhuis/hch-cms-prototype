import { useApp } from '../context/AppContext';
import { api } from '../api';
import { useState } from 'react';

export default function Topbar({ onFitView }) {
  const app = useApp();
  const { relations, locations, locationIdx, setLocationIdx, currentLocation, loadData, showToast, selectDirect, setSelected } = app;
  const [relFilter, setRelFilter] = useState('');

  const filteredLocs = relFilter ? locations.filter(l => l.RelationId === relFilter) : locations;
  const currentRel = currentLocation ? relations.find(r => r.Id === currentLocation.RelationId) : null;

  function onRelChange(e) {
    setRelFilter(e.target.value);
    setSelected(null);
    const filtered = e.target.value ? locations.filter(l => l.RelationId === e.target.value) : locations;
    if (filtered.length) setLocationIdx(locations.indexOf(filtered[0]));
  }

  function onLocChange(e) {
    setLocationIdx(+e.target.value);
    setSelected(null);
    onFitView();
  }

  function newRelation() {
    const name = window.prompt('Naam nieuwe relatie:');
    if (!name) return;
    api.createRelation({ Name: name }).then(() => {
      showToast('Relatie aangemaakt');
      loadData();
    }).catch(e => showToast(e.message, true));
  }

  function newLocation() {
    const name = window.prompt('Naam nieuwe locatie:');
    if (!name) return;
    const data = { Name: name };
    if (relFilter) data.RelationId = relFilter;
    api.createLocation(data).then(() => {
      showToast('Locatie aangemaakt');
      loadData();
    }).catch(e => showToast(e.message, true));
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">⌬</div>
        <div className="name">Greenhouse CMS <small className="mono">v0.2</small></div>
      </div>
      <nav className="breadcrumb">
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
          onClick={() => { if (currentRel) selectDirect('relation', currentRel, {}); }}
        >
          {currentRel ? currentRel.Name : 'Relaties'}
        </span>
        <span className="sep">/</span>
        <b>{currentLocation?.Name || '—'}</b>
      </nav>
      <div className="switcher">
        <span className="badge mono" id="entity-count">
          {app.hitItems.length} entiteiten
        </span>
        <select value={relFilter} onChange={onRelChange} title="Relatie">
          <option value="">— alle relaties</option>
          {relations.map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
        </select>
        <select value={locationIdx} onChange={onLocChange} title="Locatie">
          {filteredLocs.map(l => (
            <option key={l.Id} value={locations.indexOf(l)}>
              {l.PublicId} · {l.Name}
            </option>
          ))}
        </select>
        <button onClick={newRelation}>+ Relatie</button>
        <button onClick={newLocation}>+ Locatie</button>
        <button onClick={onFitView}>Fit</button>
      </div>
    </header>
  );
}
