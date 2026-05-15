import { useEffect, useCallback } from 'react';
import './App.css';
import { useApp } from './context/AppContext';
import Topbar from './components/Topbar';
import Legend from './components/Legend';
import CanvasView from './components/canvas/CanvasView';
import Panel from './components/panel/Panel';
import Modal from './components/Modal';
import Toast from './components/Toast';
import { buildLayout } from './components/canvas/layout';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;

export default function App() {
  const app = useApp();
  const { loadData, currentLocation, view, setView, expandedCaps, expandedCults, toast, modal, setModal } = app;

  useEffect(() => { loadData(); }, []);

  const fitView = useCallback(() => {
    if (!currentLocation) return;
    const stageEl = document.querySelector('.stage-wrap');
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const layout = buildLayout(currentLocation, expandedCaps, expandedCults);
    const pad = 40;
    const sx = (rect.width - 2 * pad) / layout.bounds.w;
    const sy = (rect.height - 2 * pad) / layout.bounds.h;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
    setView({ x: rect.width / 2, y: rect.height / 2, scale });
  }, [currentLocation, expandedCaps, expandedCults, setView]);

  function zoomBy(factor) {
    const stageEl = document.querySelector('.stage-wrap');
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const wx = (cx - view.x) / view.scale;
    const wy = (cy - view.y) / view.scale;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
    setView({ x: cx - wx * newScale, y: cy - wy * newScale, scale: newScale });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar onFitView={fitView} />
      <div className="app-layout">
        <section className="stage-wrap">
          <CanvasView />
          <Legend
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onZoomReset={fitView}
          />
        </section>
        <Panel />
      </div>
      {modal && <Modal modal={modal} onClose={() => setModal(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
