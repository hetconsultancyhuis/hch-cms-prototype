import { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import { useApp } from '../../context/AppContext';
import { buildLayout } from './layout';
import { ASSET_KINDS, BUFFER_KINDS, assetKindCfg } from '../../constants';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;

function itemKey(item, locationId = '') {
  return `${locationId}:${item.kind}:${item.ref?.Id ?? JSON.stringify(item.ref).slice(0, 32)}`;
}

function refId(item) {
  return item.ref?.Id ?? JSON.stringify(item.ref).slice(0, 32);
}

// ── Focus: compute which ref IDs stay at full opacity when something is selected ──
function computeRelated(payload, items) {
  if (!payload) return null;
  const { kind, ref, parents } = payload;
  if (kind === 'location') return null; // whole canvas is "in scope"

  const rel = new Set();
  const add = (id) => { if (id) rel.add(id); };

  add(ref?.Id);
  add(parents?.loc?.Id); // location container always stays

  switch (kind) {
    case 'greenhouse':
      // all children of this greenhouse
      items.forEach(it => { if (it.parents?.gh?.Id === ref.Id) add(it.ref?.Id); });
      break;

    case 'asset':
      add(parents?.gh?.Id);
      items.filter(it => it.kind === 'capacity' && it.parents?.asset?.Id === ref.Id)
           .forEach(it => add(it.ref?.Id));
      items.filter(it => it.kind === 'allocationpoint' && (it.ref?.AssetIds || []).includes(ref.Id))
           .forEach(it => { add(it.ref?.Id); add(it.parents?.conn?.Id); });
      break;

    case 'capacity':
      add(parents?.asset?.Id);
      add(parents?.gh?.Id);
      break;

    case 'cultivation':
      add(parents?.gh?.Id);
      break;

    case 'allocationpoint':
      add(parents?.conn?.Id);
      (ref?.AssetIds || []).forEach(assetId => {
        add(assetId);
        const a = items.find(it => it.kind === 'asset' && it.ref?.Id === assetId);
        if (a) add(a.parents?.gh?.Id);
      });
      break;

    case 'gasconn':
    case 'elecconn':
      items.filter(it => it.kind === 'allocationpoint' && it.parents?.conn?.Id === ref.Id)
           .forEach(it => {
             add(it.ref?.Id);
             (it.ref?.AssetIds || []).forEach(assetId => {
               add(assetId);
               const a = items.find(ai => ai.kind === 'asset' && ai.ref?.Id === assetId);
               if (a) add(a.parents?.gh?.Id);
             });
           });
      items.filter(it => (it.kind === 'gasGridContract' || it.kind === 'elecGridContract')
                      && it.parents?.conn?.Id === ref.Id)
           .forEach(it => add(it.ref?.Id));
      break;

    case 'buffer':
      (ref?.GreenhouseIds || []).forEach(id => add(id));
      break;

    case 'gasGridContract':
    case 'elecGridContract':
      add(parents?.conn?.Id);
      break;

    default: break;
  }

  return rel;
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
function LocationNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd, opacity = 1 }) {
  const { w, h, ref: loc } = item;
  const pad = 30;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
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
function GreenhouseNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd, opacity = 1 }) {
  const { w, h, ref: gh } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
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
function AssetNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd, opacity = 1 }) {
  const { w, h, ref: asset } = item;
  const cfg = assetKindCfg(asset);
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
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
function CapToggleNode({ item, pos, expandedCaps, onSelect, opacity = 1 }) {
  const { w, h, ref: asset } = item;
  const count = (asset.Capacities || []).length;
  const expanded = expandedCaps.has(asset.Id);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#e2e8f0" />
      <Text x={0} y={0} width={w} height={h}
        text={`${expanded ? '▲' : '▼'}  ${count} profiel${count !== 1 ? 'en' : ''}`}
        fill="#64748b" fontSize={8} fontFamily="IBM Plex Mono, monospace"
        align="center" verticalAlign="middle" />
    </Group>
  );
}

// ── Capacity ───────────────────────────────────────────────────────────────────
function CapacityNode({ item, pos, selectedRefId, onSelect, opacity = 1 }) {
  const { w, h, ref: cp } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} cornerRadius={4} />
      <Text x={6} y={6} width={w - 12} text={cp.Name || ''}
        fill="#475569" fontSize={9} fontFamily="IBM Plex Mono, monospace" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={4} />}
    </Group>
  );
}

// ── Cultivation toggle ─────────────────────────────────────────────────────────
function CultToggleNode({ item, pos, expandedCults, onSelect, opacity = 1 }) {
  const { w, h, ref: gh } = item;
  const count = (gh.Cultivations || []).length;
  const expanded = expandedCults.has(gh.Id);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#dcfce7" cornerRadius={3} />
      <Text x={0} y={0} width={w} height={h}
        text={`${expanded ? '▲' : '▼'}  ${count} teelt${count !== 1 ? 'en' : ''}`}
        fill="#15803d" fontSize={8} fontFamily="IBM Plex Mono, monospace"
        align="center" verticalAlign="middle" />
    </Group>
  );
}

// ── Cultivation chip ───────────────────────────────────────────────────────────
function CultivationNode({ item, pos, selectedRefId, onSelect, opacity = 1 }) {
  const { w, h, ref: c } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#f0fdf4" stroke="#86efac" strokeWidth={1} cornerRadius={4} />
      <Rect x={0} y={0} width={4} height={h} fill="#15803d" cornerRadius={[4, 0, 0, 4]} />
      <Text x={10} y={0} width={w * 0.45 - 10} height={h}
        text={c.Name || ''} fill="#14532d" fontSize={9}
        fontFamily="IBM Plex Sans, sans-serif" verticalAlign="middle" ellipsis />
      <Text x={w * 0.45} y={0} width={w * 0.55 - 4} height={h}
        text={`${c.DateStart || '?'} – ${c.DateEnd || '∞'}`}
        fill="#15803d" fontSize={8} fontFamily="IBM Plex Mono, monospace"
        align="right" verticalAlign="middle" />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={4} />}
    </Group>
  );
}

// ── Buffer ─────────────────────────────────────────────────────────────────────
function BufferNode({ item, pos, selectedRefId, onSelect, onDragMove, onDragEnd, opacity = 1 }) {
  const { w, h, ref: buf } = item;
  const cfg = BUFFER_KINDS[buf.Kind] || BUFFER_KINDS.Heat;
  const r = h / 2;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
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
function ConnectionNode({ item, pos, kind, selectedRefId, onSelect, onDragMove, onDragEnd, opacity = 1 }) {
  const { w, h, ref: conn } = item;
  const color = kind === 'gas' ? '#b45309' : '#1d4ed8';
  const tint  = kind === 'gas' ? '#fef3c7' : '#dbeafe';
  const label = kind === 'gas' ? 'GAS  AANSLUITING' : 'ELEK  AANSLUITING';
  const aps = (conn.AllocationPoints || []).length;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} draggable onDragMove={onDragMove} onDragEnd={onDragEnd}
      onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
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

// ── Allocation point row ───────────────────────────────────────────────────────
function AllocationPointNode({ item, pos, selectedRefId, onSelect, opacity = 1 }) {
  const { w, h, ref: ap } = item;
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} cornerRadius={3} />
      <Rect x={0} y={0} width={3} height={h} fill="#6d28d9" cornerRadius={[3, 0, 0, 3]} />
      <Text x={8} y={0} width={24} height={h} text="AP" fill="#6d28d9" fontSize={7}
        fontFamily="IBM Plex Mono, monospace" verticalAlign="middle" />
      <Text x={34} y={0} width={w - 38} height={h}
        text={`${ap.Name || ''}  ${ap.Direction || ''}`}
        fill="#0f172a" fontSize={9} fontFamily="IBM Plex Sans, sans-serif"
        verticalAlign="middle" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={3} />}
    </Group>
  );
}

// ── Grid contract row ──────────────────────────────────────────────────────────
function GridContractNode({ item, pos, selectedRefId, onSelect, opacity = 1 }) {
  const { w, h, ref: gc } = item;
  const isGas = item.kind === 'gasGridContract';
  const color = isGas ? '#92400e' : '#1e40af';
  const short = isGas ? 'GGC' : 'EGC';
  const sel = selectedRefId === refId(item);
  return (
    <Group x={pos.x} y={pos.y} onClick={e => { e.cancelBubble = true; onSelect(item); }} opacity={opacity}>
      <Rect x={0} y={0} width={w} height={h} fill="#fffbeb" stroke="#fde68a" strokeWidth={1} cornerRadius={3} />
      <Text x={6} y={0} width={28} height={h} text={short} fill={color} fontSize={7}
        fontFamily="IBM Plex Mono, monospace" verticalAlign="middle" />
      <Text x={38} y={0} width={w - 42} height={h}
        text={gc.Name || ''} fill="#0f172a" fontSize={9}
        fontFamily="IBM Plex Sans, sans-serif" verticalAlign="middle" ellipsis />
      {sel && <SelectRing x={0} y={0} w={w} h={h} r={3} />}
    </Group>
  );
}

// ── AP → Asset connector lines ────────────────────────────────────────────────
function ApAssetLines({ items }) {
  const aps    = items.filter(it => it.kind === 'allocationpoint');
  const assets = items.filter(it => it.kind === 'asset');
  if (!aps.length || !assets.length) return null;

  const lines = [];
  aps.forEach((ap, i) => {
    const assetIds = ap.ref.AssetIds || [];
    const color    = ap.parents?.connKind === 'elec' ? '#1d4ed8' : '#b45309';
    assetIds.forEach((assetId, j) => {
      const assetItem = assets.find(a => a.ref.Id === assetId);
      if (!assetItem) return;
      const x1   = ap.x + ap.w / 2;
      const y1   = ap.y;
      const x2   = assetItem.x + assetItem.w / 2;
      const y2   = assetItem.y + assetItem.h;
      const midY = y1 - (y1 - y2) * 0.45;
      lines.push(
        <Line key={`apa-${i}-${j}`}
          points={[x2, y2, x2, midY, x1, midY, x1, y1]}
          stroke={color} strokeWidth={1.5} opacity={0.45}
          dash={[5, 6]} tension={0.3} listening={false} />,
      );
    });
  });
  return <>{lines}</>;
}

// ── Pipe lines (asset → buffer → greenhouse) ───────────────────────────────────
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
  const [posMap, setPosMap] = useState({});

  const {
    currentLocation, selected, view, setView,
    expandedCaps, expandedCults,
    setHitItems, selectItem, toggleCapExpanded, toggleCultExpanded,
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

  // Trim posMap entries that no longer belong to the current location
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
    const layout = buildLayout(currentLocation, expandedCaps, expandedCults);
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
        const layout = buildLayout(currentLocation, expandedCaps, expandedCults);
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
  }, [currentLocation, expandedCaps, expandedCults, selectItem, setView]);

  // Stage pan: sync back to view state after drag
  const handleStageDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const newView = { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
    syncedView.current = newView;
    setView(newView);
  };

  const locId = currentLocation?.Id ?? '';

  const handleItemDrag = (item, e) => {
    const key = itemKey(item, locId);
    const x = e.target.x(), y = e.target.y();
    setPosMap(prev => ({ ...prev, [key]: { x, y } }));
  };

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
    () => currentLocation ? buildLayout(currentLocation, expandedCaps, expandedCults) : null,
    [currentLocation, expandedCaps, expandedCults],
  );
  const items = layout?.items ?? [];

  useEffect(() => { setHitItems(items); }, [layout, setHitItems]);

  const selectedRefId = selected?.refId ?? null;

  const relatedIds = useMemo(
    () => selected ? computeRelated(selected.payload, items) : null,
    [selected, items],
  );
  const isDimmed = (item) => !!relatedIds && !relatedIds.has(item.ref?.Id);

  const onSelect = (item) => {
    if (item.kind === 'cap-toggle') toggleCapExpanded(item.ref.Id);
    else if (item.kind === 'cult-toggle') toggleCultExpanded(item.ref.Id);
    else selectItem(item);
  };

  // Effective position: posMap override for draggable items; parent-offset for children
  const getPos = (item) => {
    const draggable = ['location', 'greenhouse', 'asset', 'buffer', 'gasconn', 'elecconn'];
    if (draggable.includes(item.kind)) {
      return posMap[itemKey(item, locId)] ?? { x: item.x, y: item.y };
    }
    let parentItem = null;
    if (item.kind === 'cap-toggle') {
      parentItem = items.find(it => it.kind === 'asset' && it.ref === item.ref);
    } else if (item.kind === 'capacity') {
      parentItem = items.find(it => it.kind === 'asset' && it.ref === item.parents?.asset);
    } else if (item.kind === 'cult-toggle') {
      parentItem = items.find(it => it.kind === 'greenhouse' && it.ref === item.ref);
    } else if (item.kind === 'cultivation') {
      parentItem = items.find(it => it.kind === 'greenhouse' && it.ref === item.parents?.gh);
    } else if (item.kind === 'allocationpoint' || item.kind === 'gasGridContract' || item.kind === 'elecGridContract') {
      parentItem = items.find(it => (it.kind === 'gasconn' || it.kind === 'elecconn') && it.ref === item.parents?.conn);
    }
    if (!parentItem) return { x: item.x, y: item.y };
    const pp = posMap[itemKey(parentItem, locId)] ?? { x: parentItem.x, y: parentItem.y };
    return { x: item.x + pp.x - parentItem.x, y: item.y + pp.y - parentItem.y };
  };

  const effectiveItems = items.map(item => {
    const { x, y } = getPos(item);
    return { ...item, x, y };
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
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'greenhouse').map(it => (
            <GreenhouseNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          <PipeLines items={effectiveItems} />
          <ApAssetLines items={effectiveItems} />
          {items.filter(it => it.kind === 'asset').map(it => (
            <AssetNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'cap-toggle').map(it => (
            <CapToggleNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              expandedCaps={expandedCaps} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'capacity').map(it => (
            <CapacityNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'cult-toggle').map(it => (
            <CultToggleNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              expandedCults={expandedCults} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'cultivation').map(it => (
            <CultivationNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'buffer').map(it => (
            <BufferNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'gasconn').map(it => (
            <ConnectionNode key={itemKey(it, locId)} item={it} pos={getPos(it)} kind="gas"
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'elecconn').map(it => (
            <ConnectionNode key={itemKey(it, locId)} item={it} pos={getPos(it)} kind="elec"
              selectedRefId={selectedRefId} onSelect={onSelect} {...dragHandlers(it)}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'allocationpoint').map(it => (
            <AllocationPointNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'gasGridContract').map(it => (
            <GridContractNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
          {items.filter(it => it.kind === 'elecGridContract').map(it => (
            <GridContractNode key={itemKey(it, locId)} item={it} pos={getPos(it)}
              selectedRefId={selectedRefId} onSelect={onSelect}
              opacity={isDimmed(it) ? 0.2 : 1} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
