// Layout constants (world units)
const LOC_PAD = 60;
const LOC_HDR = 64;
const GH_GAP = 80;
const GH_IPAD = 16;
const GH_TOP = 64;
const GH_BOT = 16;
const GH_MIN_H = 200;
const GH_MIN_W = 720;
const ASSET_W = 110;
const ASSET_H = 110;
const ASSET_GAP = 24;
const CAP_TOGGLE_H = 18;
const CP_GAP = 6;
const CP_STRIDE = 40;
const CP_BOX_H = 36;
const BUF_H = 64;
const BUF_ITEM_GAP = 12;
const BUF_SEC_GAP = 32;
const CONN_W = 200;
const CONN_H = 60;
const CONN_GAP = 12;
const CONN_SEC_GAP = 32;

export function buildLayout(loc, expandedCaps) {
  const items = [];
  const ghs = loc.Greenhouses || [];

  const ghSizes = ghs.map(gh => {
    const assets = gh.Assets || [];
    const maxCPs = assets.reduce((m, a) => {
      const n = expandedCaps.has(a.Id) ? (a.Capacities || []).length : 0;
      return Math.max(m, n);
    }, 0);
    const assetSectionH = assets.length > 0
      ? ASSET_H + CAP_TOGGLE_H + (maxCPs > 0 ? CP_GAP + maxCPs * CP_STRIDE : 0)
      : 0;
    const ghH = Math.max(GH_MIN_H, GH_TOP + assetSectionH + GH_BOT);
    const totalAssetsW = assets.length > 0
      ? assets.length * ASSET_W + (assets.length - 1) * ASSET_GAP
      : 0;
    const ghW = Math.max(GH_MIN_W, totalAssetsW + 2 * GH_IPAD);
    return { ghH, ghW, assetSectionH };
  });

  const maxGhW = ghSizes.length > 0 ? Math.max(...ghSizes.map(s => s.ghW)) : GH_MIN_W;
  const totalGhH = ghs.length > 0
    ? ghSizes.reduce((sum, s) => sum + s.ghH, 0) + (ghs.length - 1) * GH_GAP
    : GH_MIN_H;

  const locBufs = loc.Buffers || [];
  const hasBufs = locBufs.length > 0;
  const bufSectionH = hasBufs ? BUF_SEC_GAP + BUF_H : 0;

  const gasConns = loc.GasConnections || [];
  const elecConns = loc.ElectricityConnections || [];
  const hasConns = gasConns.length > 0 || elecConns.length > 0;
  const connSectionH = hasConns ? CONN_SEC_GAP + CONN_H : 0;

  const LOC_W = maxGhW + 2 * LOC_PAD;
  const LOC_H = LOC_PAD * 2 + LOC_HDR + totalGhH + bufSectionH + connSectionH;
  const loc_x = -LOC_W / 2;
  const loc_y = -LOC_H / 2;

  items.push({ kind: 'location', x: loc_x, y: loc_y, w: LOC_W, h: LOC_H, ref: loc });

  let curY = loc_y + LOC_PAD + LOC_HDR;
  ghs.forEach((gh, i) => {
    const { ghH } = ghSizes[i];
    const ghW = maxGhW;
    const bx = loc_x + LOC_PAD;
    const by = curY;

    items.push({ kind: 'greenhouse', x: bx, y: by, w: ghW, h: ghH, ref: gh, parents: { loc } });

    const assets = gh.Assets || [];
    if (assets.length > 0) {
      const totalAssetsW = assets.length * ASSET_W + (assets.length - 1) * ASSET_GAP;
      const ax0 = bx + (ghW - totalAssetsW) / 2;
      assets.forEach((a, j) => {
        const ax = ax0 + j * (ASSET_W + ASSET_GAP);
        const ay = by + GH_TOP;
        items.push({ kind: 'asset', x: ax, y: ay, w: ASSET_W, h: ASSET_H, ref: a, parents: { loc, gh } });
        items.push({ kind: 'cap-toggle', x: ax, y: ay + ASSET_H, w: ASSET_W, h: CAP_TOGGLE_H, ref: a, parents: { loc, gh } });
        if (expandedCaps.has(a.Id)) {
          (a.Capacities || []).forEach((cp, k) => {
            items.push({
              kind: 'capacity',
              x: ax,
              y: ay + ASSET_H + CAP_TOGGLE_H + CP_GAP + k * CP_STRIDE,
              w: ASSET_W,
              h: CP_BOX_H,
              ref: cp,
              parents: { loc, gh, asset: a },
            });
          });
        }
      });
    }

    curY += ghH + GH_GAP;
  });

  if (hasBufs) {
    const bufY = loc_y + LOC_PAD + LOC_HDR + totalGhH + BUF_SEC_GAP;
    const bx = loc_x + LOC_PAD;
    const bufAvailW = maxGhW - 2 * GH_IPAD;
    const bufW = (bufAvailW - (locBufs.length - 1) * BUF_ITEM_GAP) / locBufs.length;
    locBufs.forEach((bf, k) => {
      items.push({
        kind: 'buffer',
        x: bx + GH_IPAD + k * (bufW + BUF_ITEM_GAP),
        y: bufY,
        w: bufW,
        h: BUF_H,
        ref: bf,
        parents: { loc },
      });
    });
  }

  if (hasConns) {
    const connY = loc_y + LOC_PAD + LOC_HDR + totalGhH + bufSectionH + CONN_SEC_GAP;
    const bx = loc_x + LOC_PAD;
    gasConns.forEach((gc, i) => {
      items.push({ kind: 'gasconn', x: bx + GH_IPAD + i * (CONN_W + CONN_GAP), y: connY, w: CONN_W, h: CONN_H, ref: gc, parents: { loc } });
    });
    elecConns.forEach((ec, j) => {
      items.push({ kind: 'elecconn', x: bx + maxGhW - GH_IPAD - (j + 1) * CONN_W - j * CONN_GAP, y: connY, w: CONN_W, h: CONN_H, ref: ec, parents: { loc } });
    });
  }

  return {
    items,
    bounds: { x: loc_x - 40, y: loc_y - 40, w: LOC_W + 80, h: LOC_H + 80 },
  };
}
