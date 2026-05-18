import { useApp } from '../context/AppContext';
import { assetKindCfg, BUFFER_KINDS } from '../constants';

const KIND_META = {
  location:         { short: 'LC',  color: '#0f172a' },
  greenhouse:       { short: 'KS',  color: '#0e7490' },
  cultivation:      { short: 'TL',  color: '#15803d' },
  buffer:           { short: 'BU',  color: '#b91c1c' },
  gasconn:          { short: 'GAS', color: '#b45309' },
  elecconn:         { short: 'ELE', color: '#1d4ed8' },
  allocationpoint:  { short: 'AP',  color: '#6d28d9' },
  gasGridContract:  { short: 'GGC', color: '#92400e' },
  elecGridContract: { short: 'EGC', color: '#1e40af' },
};

export default function TreePanel() {
  const { currentLocation, view, selected, selectDirect, findHitItem, selectItem } = useApp();

  const loc = currentLocation;
  if (!loc) return <div className="tree-panel" />;

  const zoom = Math.round((view?.scale ?? 1) * 100);
  const ghCount = (loc.Greenhouses || []).length;
  const selectedRefId = selected?.refId ?? null;

  function pick(kind, ref, parents) {
    const it = findHitItem(i => i.kind === kind && i.ref?.Id === ref?.Id);
    if (it) selectItem(it);
    else selectDirect(kind, ref, parents);
  }

  const nodes = [];
  const push = (depth, kind, ref, parents, meta) =>
    nodes.push({ depth, kind, ref, parents, meta });

  push(0, 'location', loc, {}, KIND_META.location);

  (loc.Greenhouses || []).forEach(gh => {
    push(1, 'greenhouse', gh, { loc }, KIND_META.greenhouse);
    (gh.Assets || []).forEach(a => {
      const cfg = assetKindCfg(a);
      push(2, 'asset', a, { loc, gh }, { short: cfg.short, color: cfg.color });
    });
    (gh.Cultivations || []).forEach(c =>
      push(2, 'cultivation', c, { loc, gh }, KIND_META.cultivation));
  });

  (loc.Buffers || []).forEach(bf => {
    const cfg = BUFFER_KINDS[bf.Kind] || BUFFER_KINDS.Heat;
    push(1, 'buffer', bf, { loc }, { short: cfg.short, color: cfg.color });
  });

  (loc.GasConnections || []).forEach(gc => {
    push(1, 'gasconn', gc, { loc }, KIND_META.gasconn);
    (gc.AllocationPoints || []).forEach(ap =>
      push(2, 'allocationpoint', ap, { conn: gc, connKind: 'gas', loc }, KIND_META.allocationpoint));
    (gc.GridContracts || []).forEach(ggc =>
      push(2, 'gasGridContract', ggc, { conn: gc, loc }, KIND_META.gasGridContract));
  });

  (loc.ElectricityConnections || []).forEach(ec => {
    push(1, 'elecconn', ec, { loc }, KIND_META.elecconn);
    (ec.AllocationPoints || []).forEach(ap =>
      push(2, 'allocationpoint', ap, { conn: ec, connKind: 'elec', loc }, KIND_META.allocationpoint));
    (ec.GridContracts || []).forEach(egc =>
      push(2, 'elecGridContract', egc, { conn: ec, loc }, KIND_META.elecGridContract));
  });

  return (
    <div className="tree-panel">
      <div className="tree-head">
        <div className="tree-loc">{loc.Name || '—'}</div>
        <div className="tree-sub">{ghCount} kassen · {zoom}%</div>
      </div>
      <div className="tree-body">
        {nodes.map((node, i) => {
          const isSel = node.ref?.Id === selectedRefId;
          return (
            <div
              key={`${node.kind}-${node.ref?.Id ?? i}`}
              className={`tree-row${isSel ? ' tree-sel' : ''}`}
              style={{ paddingLeft: 8 + node.depth * 14 }}
              onClick={() => pick(node.kind, node.ref, node.parents)}
            >
              <span className="tree-badge" style={{ background: node.meta.color }}>
                {node.meta.short}
              </span>
              <span className="tree-name">{node.ref?.Name || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
