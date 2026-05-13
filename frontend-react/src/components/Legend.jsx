import { useApp } from '../context/AppContext';

export default function Legend({ onZoomIn, onZoomOut, onZoomReset }) {
  const { view, currentLocation, hitItems } = useApp();

  return (
    <>
      <div className="scale-meta">
        <span className="dot" />
        <span className="mono">{currentLocation ? `${currentLocation.Name} · ${(currentLocation.Greenhouses || []).length} kassen` : '—'}</span>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>{Math.round(view.scale * 100)}%</span>
      </div>
      <div className="legend">
        <h6>Stromen</h6>
        <div className="row"><span className="swatch" style={{ background: 'var(--elec)' }} /> Elektriciteit</div>
        <div className="row"><span className="swatch" style={{ background: 'var(--gas)' }} /> Gas</div>
        <div className="row"><span className="swatch" style={{ background: 'var(--heat)' }} /> Warmte</div>
        <div className="row"><span className="swatch" style={{ background: 'var(--co2)' }} /> CO₂</div>
        <div className="row"><span className="swatch" style={{ background: 'var(--buffer)' }} /> Buffer</div>
      </div>
      <div className="zoom">
        <button onClick={onZoomIn}>＋</button>
        <button onClick={onZoomOut}>−</button>
        <button onClick={onZoomReset}>⟲</button>
      </div>
    </>
  );
}
