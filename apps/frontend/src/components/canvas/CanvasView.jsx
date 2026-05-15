import { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import { useApp } from '../../context/AppContext';
import { buildLayout } from './layout';
import { ASSET_KINDS, BUFFER_KINDS } from '../../constants';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;

// Unique key per item, scoped to a location so drag positions never leak between locations
function itemKey(item, locationId = '') {
  return `${locationId}:${item.kind}:${item.ref?.Id ?? JSON.stringify(item.ref).slice(0, 32)}`;
}

// Key for selection comparison (entity id only, matches AppContext.selectItem)
function refId(item) {
  return item.ref?.Id ?? JSON.stringify(item.ref).slice(0, 32);
}

// ── Selection ring ─────────────────────────────────────────────────────────────
function SelectRing({ x, y, w, h, r = 8 }) {
  return (
    <Rect
      x={x - 3} y={y - 3} width={w + 6} height={h + 6}
      cornerRadius={r + 3} stroke="#0f172a" strokeWidth={2} fill="transparent"
      listening={false}
    />
  );
}

// ── Location ───────────────────────────────────────────────────────────────────
function LocationNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd }) {
  const { w, h, ref: loc } = item;
  const pad = 30;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#f3f5f8" stroke="#cbd5e1" strokeWidth={1} cornerRadius={14} />
      <Rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} fill="#fff" stroke="#e2e8f0" strokeWidth={1} cornerRadius={10} />
      <Rect x={pad} y={pad - 16} width={180} height={28} fill="#0f172a" cornerRadius={6} />
      <Text x={pad + 8} y={pad - 16} width={180} height={28}
        text={`LOCATIE  ${loc.PublicId || ''}   ${loc.Name || ''}`}
        fill="#fff" fontSize={11} fontFamily="IBM Plex Mono, monospace" verticalAlign="middle" ellipsis />
      {[
        { label: 'Kassen',  n: (loc.Greenhouses || []).length, color: '#0e7490' },
        { label: 'Teelten', n: (loc.Greenhouses || []).reduce((s, g) => s + (g.Cultivations || []).length, 0), color: '#15803d' },
        { label: 'Buffers', n: (loc.Buffers || []).length, color: '#b91c1c' },
      ].map((s, i) => (
        <Group key={i}>
          <Rect x={pad + 8 + i * 90} y={pad + 14} width={82} height={18} fill={s.color} opacity={0.08} cornerRadius={4} />
          <Text x={pad + 14 + i * 90} y={pad + 14} width={76} height={18}
            text={`${s.label}  ${s.n}`} fill={s.color} fontSize={8.5}
            fontFamily="IBM Plex Mono, monospace" verticalAlign="middle" />
        </Group>
      ))}
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={14} />}
    </Group>
  );
}

// ── Greenhouse ─────────────────────────────────────────────────────────────────
function GreenhouseNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd }) {
  const { w, h, ref: gh } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#f1f5f9" stroke="#0e7490" strokeWidth={1} cornerRadius={8} />
      <Rect x={0} y={0} width={w} height={36} fill="#0e7490" cornerRadius={[8, 8, 0, 0]} />
      <Text x={14} y={0} width={w - 120} height={36}
        text={gh.Name || ''} fill="#fff" fontSize={13}
        fontFamily="IBM Plex Sans, sans-serif" verticalAlign="middle" ellipsis />
      <Text x={w - 120} y={0} width={110} height={36}
        text={`${(gh.Assets || []).length} assets  ${(gh.Cultivations || []).length} teelten`}
        fill="rgba(255,255,255,0.7)" fontSize={10} fontFamily="IBM Plex Mono, monospace"
        align="right" verticalAlign="middle" />
      {sel && <SelectRing x={0} y={0} w={w} h={h} />}
    </Group>
  );
}

// ── Asset ──────────────────────────────────────────────────────────────────────
function AssetNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd }) {
  const { w, h, ref: asset } = item;
  const cfg = ASSET_KINDS[asset.Kind] || ASSET_KINDS.WKK;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#fff" stroke="#e2e8f0" strokeWidth={1} cornerRadius={8} />
      <Rect x={0} y={0} width={w} height={6} fill={cfg.color} cornerRadius={[4, 4, 0, 0]} />
      <Rect x={6} y={10} width={34} height={14} fill={cfg.tint} cornerRadius={3} />
      <Text x={6} y={10} width={34} height={14} text={cfg.short} fill={cfg.color}
        fontSize={9} fontFamily="IBM Plex Mono, monospace" align="center" verticalAlign="middle" />
      <Text x={0} y={h / 2 - 16} width={w} height={32} text={cfg.short}
        fill={cfg.color} opacity={0.15} fontSize={28}
        fontFamily="IBM Plex Mono, monospace" align="center" verticalAlign="middle" />
      <Text x={6} y={h - 20} width={w - 12} text={asset.Name || ''}
        fill="#0f172a" fontSize={9} fontFamily="IBM Plex Sans, sans-serif" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} />}
    </Group>
  );
}

// ── Capacity toggle ────────────────────────────────────────────────────────────
function CapToggleNode({ item, pos, expandedCaps, onSelect }) {
  const { w, h, ref: asset } = item;
  const count = (asset.Capacities || []).length;
  const expanded = expandedCaps.has(asset.Id);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#e2e8f0" />
      <Text x={0} y={0} width={w} height={h}
        text={`${expanded ? '▲' : '▼'}  ${count} profiel${count !== 1 ? 'en' : ''}`}
        fill="#64748b" fontSize={8} fontFamily="IBM Plex Mono, monospace"
        align="center" verticalAlign="middle" />
    </Group>
  );
}

// ── Capacity ───────────────────────────────────────────────────────────────────
function CapacityNode({ item, pos, selectedRefId, onSelect }) {
  const { w, h, ref: cp } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} cornerRadius={4} />
      <Text x={6} y={6} width={w - 12} text={cp.Name || ''}
        fill="#475569" fontSize={9} fontFamily="IBM Plex Mono, monospace" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={4} />}
    </Group>
  );
}

// ── Buffer ─────────────────────────────────────────────────────────────────────
function BufferNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd }) {
  const { w, h, ref: buf } = item;
  const cfg = BUFFER_KINDS[buf.Kind] || BUFFER_KINDS.Heat;
  const r = h / 2;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill={cfg.tint} stroke={cfg.color} strokeWidth={1} cornerRadius={r} />
      <Text x={r + 6} y={4} width={w - r - 10}
        text={buf.Kind === 'CO2' ? 'CO2-BUFFER' : 'WARMTEBUFFER'}
        fill={cfg.color} fontSize={9} fontFamily="IBM Plex Mono, monospace" />
      <Text x={r + 6} y={18} width={w - r - 10}
        text={buf.Name || ''} fill="#0f172a" fontSize={12}
        fontFamily="IBM Plex Sans, sans-serif" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={r} />}
    </Group>
  );
}

// ── Connection ─────────────────────────────────────────────────────────────────
function ConnectionNode({ item, pos, kind, selectedRefId, onSelect, onDragMove, onDragEnd }) {
  const { w, h, ref: conn } = item;
  const color = kind === 'gas' ? '#b45309' : '#1d4ed8';
  const tint  = kind === 'gas' ? '#fef3c7' : '#dbeafe';
  const label = kind === 'gas' ? 'GAS  AANSLUITING' : 'ELEK  AANSLUITING';
  const aps = (conn.AllocationPoints || []).length;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }}>
      <Rect x={0} y={0} width={w} height={h} fill="#fff" stroke="#e2e8f0" strokeWidth={1} cornerRadius={8} />
      <Rect x={0} y={0} width={8} height={h} fill={tint} cornerRadius={[4, 0, 0, 4]} />
      <Text x={14} y={8}  text={label} fill={color} fontSize={9} fontFamily="IBM Plex Mono, monospace" />
      <Text x={14} y={22} width={w - 20} text={conn.Name || ''} fill="#0f172a" fontSize={11}
        fontFamily="IBM Plex Sans, sans-serif" ellipsis />
      <Text x={14} y={38} text={`${aps} allocatiepunt${aps !== 1 ? 'en' : ''}`}
        fill="#94a3b8" fontSize={9} fontFamily="IBM Plex Mono, monospace" />
      {sel && <SelectRing x={0} y={0} w={w} h={h} />}
    </Group>
  );
}

// ── Pipe lines (asset → buffer → greenhouse) ───────────────────────────────────
// items here are effective items (with drag positions applied)
function PipeLines({ items }) {
  const assets      = items.filter(it => it.kind === 'asset');
  const buffers     = items.filter(it => it.kind === 'buffer');
  const greenhouses = items.filter(it => it.kind === 'greenhouse');
  const lines = [];

  assets.forEach((a, i) => {
    const buf = a.ref.BufferId ? buffers.find(b => b.ref.Id === a.ref.BufferId) : null;
    if (!buf) return;
    const cfg = BUFFER_KINDS[buf.ref.Kind] || BUFFER_KINDS.Heat;
    const ax = a.x + a.w / 2, ay = a.y + a.h;
    const tx = Math.max(buf.x + 20, Math.min(buf.x + buf.w - 20, ax));
    const ty = buf.y;
    const midY = (ay + ty) / 2 + 12;
    lines.push(
      <Line key={`ab-${i}`} points={[ax, ay, ax, midY, tx, midY, tx, ty]}
        stroke={cfg.color} strokeWidth={3} opacity={0.3} tension={0.3} listening={false} />,
      <Line key={`ab-d-${i}`} points={[ax, ay, ax, midY, tx, midY, tx, ty]}
        stroke={cfg.color} strokeWidth={1.5} opacity={0.9} dash={[4, 5]} tension={0.3} listening={false} />,
    );
  });

  buffers.forEach((buf, i) => {
    const cfg = BUFFER_KINDS[buf.ref.Kind] || BUFFER_KINDS.Heat;
    const bx = buf.x + buf.w / 2, by = buf.y;
    (buf.ref.GreenhouseIds || []).forEach((ghId, j) => {
      const gh = greenhouses.find(g => g.ref.Id === ghId);
      if (!gh) return;
      const tx = gh.x + gh.w / 2, ty = gh.y + gh.h;
      const midY = (by + ty) / 2;
      lines.push(
        <Line key={`bg-${i}-${j}`} points={[bx, by, bx, midY, tx, midY, tx, ty]}
          stroke={cfg.color} strokeWidth={2} opacity={0.25} tension={0.3} listening={false} />,
      );
    });
  });

  return <>{lines}</>;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CanvasView() {
  const stageRef   = useRef(null);
  const wrapRef    = useRef(null);
  const syncedView = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [posMap, setPosMap] = useState({});   // itemKey → { x, y } overrides from dragging

  const {
    currentLocation, selected, view, setView,
    expandedCaps, setHitItems, selectItem, toggleCapExpanded,
  } = useApp();

  // Container resize
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setStageSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setStageSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Trim posMap entries that no longer belong to the current location to avoid unbounded growth
  useEffect(() => {
    setPosMap(prev => {
      const prefix = `${currentLocation?.Id ?? ''}:`;
      const filtered = Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith(prefix)));
      return Object.keys(filtered).length === Object.keys(prev).length ? prev : filtered;
    });
  }, [currentLocation?.Id]);

  // Push external view changes (fitView / zoom buttons) → Konva Stage
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || view === syncedView.current) return;
    syncedView.current = view;
    stage.position({ x: view.x, y: view.y });
    stage.scale({ x: view.scale, y: view.scale });
    stage.batchDraw();
  }, [view]);

  // Fit to location on first load / location switch
  useEffect(() => {
    if (!currentLocation || !wrapRef.current) return;
    const el = wrapRef.current;
    const layout = buildLayout(currentLocation, expandedCaps);
    const pad = 40;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(
      (el.clientWidth  - 2 * pad) / layout.bounds.w,
      (el.clientHeight - 2 * pad) / layout.bounds.h,
    )));
    setView({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.Id]);

  // Keyboard: F = fit, Escape = deselect
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { selectItem(null); return; }
      if ((e.key === 'f' || e.key === 'F') && currentLocation && wrapRef.current) {
        const el = wrapRef.current;
        const layout = buildLayout(currentLocation, expandedCaps);
        const pad = 40;
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(
          (el.clientWidth  - 2 * pad) / layout.bounds.w,
          (el.clientHeight - 2 * pad) / layout.bounds.h,
        )));
        setView({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentLocation, expandedCaps, selectItem, setView]);

  // Stage pan: sync back to view state after drag
  const handleStageDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const newView = { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
    syncedView.current = newView;
    setView(newView);
  };

  const locId = currentLocation?.Id ?? '';

  // Item drag: update posMap so pipe lines follow live
  const handleItemDrag = (item, e) => {
    const key = itemKey(item, locId);
    const x = e.target.x(), y = e.target.y();
    setPosMap(prev => ({ ...prev, [key]: { x, y } }));
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const old = stage.scaleX();
    const ptr = stage.getPointerPosition();
    const wx = (ptr.x - stage.x()) / old;
    const wy = (ptr.y - stage.y()) / old;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, old * Math.exp(-e.evt.deltaY * 0.001)));
    const pos  = { x: ptr.x - wx * next, y: ptr.y - wy * next };
    stage.scale({ x: next, y: next });
    stage.position(pos);
    const newView = { ...pos, scale: next };
    syncedView.current = newView;
    setView(newView);
  };

  const layout = useMemo(
    () => currentLocation ? buildLayout(currentLocation, expandedCaps) : null,
    [currentLocation, expandedCaps],
  );
  const items = layout?.items ?? [];

  useEffect(() => { setHitItems(items); }, [layout, setHitItems]);

  const selectedRefId = selected?.refId ?? null;

  const onSelect = (item) => {
    if (item.kind === 'cap-toggle') toggleCapExpanded(item.ref.Id);
    else selectItem(item);
  };

  // Effective position: posMap override (from drag) or base layout position
  const getPos = (item) => posMap[itemKey(item, locId)] ?? { x: item.x, y: item.y };

  // Items with drag-adjusted positions, used by PipeLines
  const effectiveItems = items.map(item => {
    const p = posMap[itemKey(item, locId)];
    return p ? { ...item, x: p.x, y: p.y } : item;
  });

  const dragHandlers = (item) => ({
    onDragMove: (e) => handleItemDrag(item, e),
    onDragEnd:  (e) => handleItemDrag(item, e),
  });

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onClick={(e) => { if (e.target === e.target.getStage()) selectItem(null); }}
      >
        <Layer>
          {items.filter(it => it.kind === 'location').map(it => (
            <LocationNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
          {items.filter(it => it.kind === 'greenhouse').map(it => (
            <GreenhouseNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
          <PipeLines items={effectiveItems} />
          {items.filter(it => it.kind === 'asset').map(it => (
            <AssetNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
          {items.filter(it => it.kind === 'cap-toggle').map(it => (
            <CapToggleNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              expandedCaps={expandedCaps} onSelect={onSelect} />
          ))}
          {items.filter(it => it.kind === 'capacity').map(it => (
            <CapacityNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} />
          ))}
          {items.filter(it => it.kind === 'buffer').map(it => (
            <BufferNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
          {items.filter(it => it.kind === 'gasconn').map(it => (
            <ConnectionNode key={itemKey(it, locId)} item={it} pos={getPos(it)} kind="gas"
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
          {items.filter(it => it.kind === 'elecconn').map(it => (
            <ConnectionNode key={itemKey(it, locId)} item={it} pos={getPos(it)} kind="elec"
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
