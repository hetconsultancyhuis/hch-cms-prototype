import { useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { drawFrame } from './renderer';
import { buildLayout } from './layout';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;

export default function CanvasView({ ck, fonts }) {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const app = useApp();
  const {
    currentLocation, selected, view, setView,
    expandedCaps, visibleRelations,
    setHitItems, selectItem, toggleCapExpanded,
    showToast,
  } = app;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // Create/recreate Skia surface when canvas size changes
  const initSurface = useCallback(() => {
    if (!ck || !canvasRef.current) return;
    const el = canvasRef.current;
    const rect = el.getBoundingClientRect();
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    if (w === 0 || h === 0) return;
    el.width = w;
    el.height = h;
    surfaceRef.current?.delete();
    const surface = ck.MakeWebGLCanvasSurface(el);
    if (!surface) {
      showToast('WebGL surface kon niet worden aangemaakt', true);
      return;
    }
    surfaceRef.current = surface;
  }, [ck, dpr, showToast]);

  // Fit view to location bounds
  const fitView = useCallback(() => {
    if (!currentLocation || !canvasRef.current) return;
    const layout = buildLayout(currentLocation, expandedCaps);
    const rect = canvasRef.current.getBoundingClientRect();
    const pad = 40;
    const sx = (rect.width - 2 * pad) / layout.bounds.w;
    const sy = (rect.height - 2 * pad) / layout.bounds.h;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
    setView({ x: rect.width / 2, y: rect.height / 2, scale });
  }, [currentLocation, expandedCaps, setView]);

  // Redraw whenever relevant state changes
  useEffect(() => {
    if (!ck || !fonts || !surfaceRef.current) return;
    const surface = surfaceRef.current;
    const skCanvas = surface.getCanvas();
    const el = canvasRef.current;
    const screenW = el.width / dpr;
    const screenH = el.height / dpr;

    // Scale canvas context by DPR
    skCanvas.save();
    skCanvas.scale(dpr, dpr);

    const items = drawFrame(ck, skCanvas, fonts, currentLocation, {
      view, selected, expandedCaps, visibleRelations,
    }, screenW, screenH);

    skCanvas.restore();
    surface.flush();
    setHitItems(items);
  }, [ck, fonts, currentLocation, selected, view, expandedCaps, visibleRelations, dpr, setHitItems]);

  // Init surface on mount and ck change
  useEffect(() => {
    initSurface();
    return () => { surfaceRef.current?.delete(); surfaceRef.current = null; };
  }, [initSurface]);

  // Fit on location change
  useEffect(() => {
    if (currentLocation) fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.Id]);

  // Resize observer
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      initSurface();
      fitView();
    });
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, [initSurface, fitView]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { app.setSelected(null); }
      if (e.key === 'f' || e.key === 'F') fitView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitView, app]);

  // ── Mouse events ────────────────────────────────────────────────────────

  const dragRef = useRef(null);

  const worldToScreen = (wx, wy) => [wx * view.scale + view.x, wy * view.scale + view.y];
  const screenToWorld = (sx, sy) => [(sx - view.x) / view.scale, (sy - view.y) / view.scale];

  const hitItems = app.hitItems;

  function hitTest(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    const prio = ['capacity', 'cap-toggle', 'asset', 'buffer', 'gasconn', 'elecconn', 'greenhouse', 'location'];
    for (const k of prio) {
      for (let i = hitItems.length - 1; i >= 0; i--) {
        const it = hitItems[i];
        if (it.kind === k && wx >= it.x && wx <= it.x + it.w && wy >= it.y && wy <= it.y + it.h) {
          return it;
        }
      }
    }
    return null;
  }

  function zoomAt(sx, sy, factor) {
    const [wx, wy] = screenToWorld(sx, sy);
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
    setView({ x: sx - wx * newScale, y: sy - wy * newScale, scale: newScale });
  }

  const onMouseDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.hypot(dx, dy) > 3) dragRef.current.moved = true;
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
  };

  const onMouseUp = (e) => {
    if (!dragRef.current) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current = null;
    if (!wasMoved) {
      const rect = canvasRef.current.getBoundingClientRect();
      const it = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (it?.kind === 'cap-toggle') {
        toggleCapExpanded(it.ref.Id);
      } else {
        selectItem(it || null);
      }
    }
  };

  // Wheel zoom — must be a non-passive native listener so preventDefault works
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // view is read inside zoomAt via closure; include it so the handler stays fresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { dragRef.current = null; }}
    />
  );
}
