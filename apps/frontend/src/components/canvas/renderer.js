import { ASSET_KINDS, BUFFER_KINDS, ASSET_BUFFER_FLOW } from '../../constants';
import { buildLayout } from './layout';

// ── Color helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function c(ck, hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex);
  return ck.Color4f(r, g, b, alpha);
}

// hex with two trailing hex-alpha chars like '#b91c1c33'
function ca(ck, hex8) {
  if (hex8.length === 9) {
    const [r, g, b] = hexToRgb(hex8.slice(0, 7));
    const a = parseInt(hex8.slice(7, 9), 16) / 255;
    return ck.Color4f(r, g, b, a);
  }
  return c(ck, hex8);
}

// ── Paint helpers ──────────────────────────────────────────────────────────

function fp(ck, hex, alpha = 1) {
  const p = new ck.Paint();
  p.setColor(c(ck, hex, alpha));
  p.setStyle(ck.PaintStyle.Fill);
  p.setAntiAlias(true);
  return p;
}

function sp(ck, hex, alpha, strokeW) {
  const p = new ck.Paint();
  p.setColor(c(ck, hex, alpha));
  p.setStyle(ck.PaintStyle.Stroke);
  p.setStrokeWidth(strokeW);
  p.setAntiAlias(true);
  return p;
}

function spLineCap(ck, hex, alpha, strokeW) {
  const p = sp(ck, hex, alpha, strokeW);
  p.setStrokeCap(ck.StrokeCap.Round);
  p.setStrokeJoin(ck.StrokeJoin.Round);
  return p;
}

// ── Text helpers ───────────────────────────────────────────────────────────

function measureWidth(font, text) {
  if (!text) return 0;
  try {
    const ids = font.getGlyphIDs(text);
    const widths = font.getGlyphWidths(ids, null);
    return widths.reduce((s, w) => s + w, 0);
  } catch (_) { return text.length * font.getSize() * 0.6; }
}

function clipText(font, text, maxW) {
  if (!text) return '';
  if (measureWidth(font, text) <= maxW) return text;
  let s = text;
  while (s.length && measureWidth(font, s + '...') > maxW) s = s.slice(0, -1);
  return s + '...';
}

// Draw text. align: 'left'|'center'|'right'. baseline: 'alphabetic'|'top'|'middle'
function drawText(canvas, ck, text, x, y, paint, font, align = 'left', baseline = 'alphabetic') {
  if (!text) return;
  let dx = x;
  if (align === 'right' || align === 'center') {
    const w = measureWidth(font, text);
    if (align === 'right') dx = x - w;
    else dx = x - w / 2;
  }
  let dy = y;
  const sz = font.getSize();
  if (baseline === 'top') dy = y + sz * 0.75;
  else if (baseline === 'middle') dy = y + sz * 0.35;
  canvas.drawText(text, dx, dy, paint, font);
}

// ── Rounded rect helpers ───────────────────────────────────────────────────

function rrect(ck, x, y, w, h, r) {
  return ck.RRectXY(ck.XYWHRect(x, y, w, h), r, r);
}

function drawRRect(canvas, ck, x, y, w, h, r, paint) {
  canvas.drawRRect(rrect(ck, x, y, w, h, r), paint);
}

// ── Selection highlight ────────────────────────────────────────────────────

function drawSelectIfMatch(ck, canvas, it, selectedRefId, scale) {
  const rid = it.ref?.Id ?? JSON.stringify(it.ref).slice(0, 32);
  if (!selectedRefId || selectedRefId !== rid) return;

  const { x, y, w, h } = it;
  const r = (it.kind === 'buffer') ? h / 2 : 8;
  const pad = 3;
  const lw = 2 / scale;

  const strokeP = sp(ck, '#0f172a', 1, lw);
  drawRRect(canvas, ck, x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad, strokeP);
  strokeP.delete();

  const fillP = fp(ck, '#ffffff');
  const cs = sp(ck, '#0f172a', 1, 1 / scale);
  const hw = 6 / scale;
  [[x - pad, y - pad], [x + w + pad, y - pad], [x - pad, y + h + pad], [x + w + pad, y + h + pad]].forEach(([cx, cy]) => {
    canvas.drawRect(ck.XYWHRect(cx - hw / 2, cy - hw / 2, hw, hw), fillP);
    canvas.drawRect(ck.XYWHRect(cx - hw / 2, cy - hw / 2, hw, hw), cs);
  });
  fillP.delete();
  cs.delete();
}

// ── Grid ───────────────────────────────────────────────────────────────────

export function drawGrid(ck, canvas, view, screenW, screenH) {
  const step = 24 * view.scale;
  if (step < 6) return;
  const ox = ((view.x % step) + step) % step;
  const oy = ((view.y % step) + step) % step;

  const p = sp(ck, '#0f172a', 0.05, 1);
  const path = new ck.Path();
  for (let x = ox; x < screenW; x += step) {
    path.moveTo(x + 0.5, 0); path.lineTo(x + 0.5, screenH);
  }
  for (let y = oy; y < screenH; y += step) {
    path.moveTo(0, y + 0.5); path.lineTo(screenW, y + 0.5);
  }
  canvas.drawPath(path, p);
  path.delete();
  p.delete();
}

// ── Location ───────────────────────────────────────────────────────────────

function drawLocation(ck, canvas, fonts, it, selectedRefId, scale) {
  const { x, y, w, h } = it;

  // Outer rounded rect
  const f1 = fp(ck, '#fafbfd');
  drawRRect(canvas, ck, x, y, w, h, 14, f1); f1.delete();
  const s1 = sp(ck, '#cbd5e1', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 14, s1); s1.delete();

  // Diagonal stripes (clipped)
  canvas.save();
  canvas.clipRRect(rrect(ck, x, y, w, h, 14), ck.ClipOp.Intersect, true);
  const stripeP = sp(ck, '#94a3b8', 0.18, 1 / scale);
  const stripes = new ck.Path();
  for (let i = -h; i < w + h; i += 12) {
    stripes.moveTo(x + i, y); stripes.lineTo(x + i + h, y + h);
  }
  canvas.drawPath(stripes, stripeP);
  stripes.delete(); stripeP.delete();
  canvas.restore();

  // Inner white rect
  const pad = 30;
  const f2 = fp(ck, '#ffffff');
  drawRRect(canvas, ck, x + pad, y + pad, w - 2 * pad, h - 2 * pad, 10, f2); f2.delete();
  const s2 = sp(ck, '#e2e8f0', 1, 1 / scale);
  drawRRect(canvas, ck, x + pad, y + pad, w - 2 * pad, h - 2 * pad, 10, s2); s2.delete();

  if (scale > 0.35) {
    const mono = fonts.mono;
    const sans = fonts.sans;
    const lPad = 12;
    const idText = `LOCATIE  ${it.ref.PublicId}`;
    mono.setSize(12);
    const idW = measureWidth(mono, idText);
    const nameW = measureWidth(mono, it.ref.Name || '');
    const lW = lPad + idW + 10 + nameW + lPad;
    const lH = 30;

    // Label badge
    const badgeF = fp(ck, '#0f172a');
    drawRRect(canvas, ck, x + pad, y + pad - lH / 2 - 2, lW, lH, 6, badgeF); badgeF.delete();

    const textPW = fp(ck, '#ffffff');
    drawText(canvas, ck, idText, x + pad + lPad, y + pad - 2, textPW, mono, 'left', 'middle');
    const textPA = fp(ck, '#ffffff', 0.75);
    mono.setSize(12);
    drawText(canvas, ck, it.ref.Name || '', x + pad + lPad + idW + 10, y + pad - 2, textPA, mono, 'left', 'middle');
    textPW.delete(); textPA.delete();

    // Summary pills
    const loc = it.ref;
    const ghs = loc.Greenhouses || [];
    const gasConns = loc.GasConnections || [];
    const elecConns = loc.ElectricityConnections || [];
    const allConns = [...gasConns, ...elecConns];
    const allAPs = allConns.flatMap(cc => cc.AllocationPoints || []);
    const stats = [
      { label: 'Kassen',        n: ghs.length,                                              color: '#0e7490' },
      { label: 'Teelten',       n: ghs.reduce((s, g) => s + (g.Cultivations || []).length, 0), color: '#15803d' },
      { label: 'Buffers',       n: (loc.Buffers || []).length,                               color: '#b91c1c' },
      { label: 'Aansluitingen', n: allConns.length,                                           color: '#b45309' },
      { label: 'Allocatiepunten', n: allAPs.length,                                           color: '#6d28d9' },
      { label: 'Contracten',    n: allAPs.reduce((s, ap) => s + (ap.Contracts || []).length, 0), color: '#0f172a' },
    ];
    const pillH = 18;
    const pillY = y + pad + lH / 2 + 6;
    mono.setSize(8.5);
    let px = x + pad + lPad;
    stats.forEach(stat => {
      const txt = `${stat.label}  ${stat.n}`;
      const tw = measureWidth(mono, txt) + 12;
      const pillFill = fp(ck, stat.color, 0.08);
      drawRRect(canvas, ck, px, pillY, tw, pillH, 4, pillFill); pillFill.delete();
      const pLabel = fp(ck, stat.color, 0.73);
      mono.setSize(8.5);
      drawText(canvas, ck, stat.label, px + 6, pillY + pillH / 2, pLabel, mono, 'left', 'middle');
      pLabel.delete();
      const pNum = fp(ck, stat.color);
      const labelW = measureWidth(mono, stat.label + '  ');
      drawText(canvas, ck, String(stat.n), px + 6 + labelW, pillY + pillH / 2, pNum, mono, 'left', 'middle');
      pNum.delete();
      px += tw + 5;
    });

    sans.setSize(13);
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

function drawGreenhouse(ck, canvas, fonts, it, selectedRefId, scale) {
  const { x, y, w, h } = it;

  const f1 = fp(ck, '#f1f5f9');
  drawRRect(canvas, ck, x, y, w, h, 8, f1); f1.delete();
  const s1 = sp(ck, '#0e7490', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 8, s1); s1.delete();

  // Header fill
  const hdrF = fp(ck, '#0e7490');
  drawRRect(canvas, ck, x, y, w, 36, 8, hdrF); hdrF.delete();
  const hdrRect = fp(ck, '#0e7490');
  canvas.drawRect(ck.XYWHRect(x, y + 28, w, 8), hdrRect); hdrRect.delete();

  if (scale > 0.3) {
    const sans = fonts.sans;
    sans.setSize(13);
    const nameP = fp(ck, '#ffffff');
    drawText(canvas, ck, it.ref.Name || '', x + 14, y + 18, nameP, sans, 'left', 'middle');
    nameP.delete();

    const mono = fonts.mono;
    mono.setSize(11);
    const assets = (it.ref.Assets || []).length;
    const cults = (it.ref.Cultivations || []).length;
    const subP = fp(ck, '#ffffff', 0.7);
    drawText(canvas, ck, `${assets} assets  ${cults} teelten`, x + w - 14, y + 18, subP, mono, 'right', 'middle');
    subP.delete();
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Asset icon ─────────────────────────────────────────────────────────────

function drawAssetIcon(ck, canvas, fonts, kind, cx, cy, size) {
  const cfg = ASSET_KINDS[kind] || ASSET_KINDS.WKK;
  const s = size;

  canvas.save();
  canvas.translate(cx, cy);

  const fillP = fp(ck, cfg.tint);
  const strokeP = spLineCap(ck, cfg.color, 1, 1.5);

  if (kind === 'WKK') {
    drawRRect(canvas, ck, -s * 0.4, -s * 0.3, s * 0.8, s * 0.6, s * 0.06, fillP);
    drawRRect(canvas, ck, -s * 0.4, -s * 0.3, s * 0.8, s * 0.6, s * 0.06, strokeP);
    const chimneys = new ck.Path();
    for (let i = 0; i < 3; i++) {
      const ox = -s * 0.25 + i * s * 0.25;
      chimneys.moveTo(ox, -s * 0.3); chimneys.lineTo(ox, -s * 0.42);
    }
    canvas.drawPath(chimneys, strokeP); chimneys.delete();
    const pipe = new ck.Path();
    pipe.moveTo(s * 0.4, -s * 0.1); pipe.lineTo(s * 0.55, -s * 0.1); pipe.lineTo(s * 0.55, -s * 0.35);
    canvas.drawPath(pipe, strokeP); pipe.delete();

  } else if (kind === 'Boiler') {
    const ov = new ck.Path();
    ov.addOval(ck.XYWHRect(-s * 0.32, -s * 0.32 - s * 0.08, s * 0.64, s * 0.16));
    canvas.drawPath(ov, fillP); canvas.drawPath(ov, strokeP); ov.delete();
    const body = new ck.Path();
    body.moveTo(-s * 0.32, -s * 0.32); body.lineTo(-s * 0.32, s * 0.32);
    body.lineTo(s * 0.32, s * 0.32); body.lineTo(s * 0.32, -s * 0.32);
    canvas.drawPath(body, strokeP); body.delete();
    const ov2 = new ck.Path();
    ov2.addOval(ck.XYWHRect(-s * 0.32, s * 0.32 - s * 0.08, s * 0.64, s * 0.16));
    canvas.drawPath(ov2, strokeP); ov2.delete();
    const flame = new ck.Path();
    flame.moveTo(0, s * 0.18);
    flame.cubicTo(-s * 0.18, s * 0.06, -s * 0.06, -s * 0.05, 0, -s * 0.18);
    flame.cubicTo(s * 0.06, -s * 0.05, s * 0.18, s * 0.06, 0, s * 0.18);
    const fp2 = fp(ck, cfg.color);
    canvas.drawPath(flame, fp2); flame.delete(); fp2.delete();

  } else if (kind === 'EBoiler') {
    drawRRect(canvas, ck, -s * 0.32, -s * 0.34, s * 0.64, s * 0.68, s * 0.08, fillP);
    drawRRect(canvas, ck, -s * 0.32, -s * 0.34, s * 0.64, s * 0.68, s * 0.08, strokeP);
    const bolt = new ck.Path();
    bolt.moveTo(s * 0.05, -s * 0.22); bolt.lineTo(-s * 0.10, s * 0.04);
    bolt.lineTo(s * 0.02, s * 0.04); bolt.lineTo(-s * 0.06, s * 0.24);
    bolt.lineTo(s * 0.16, -s * 0.04); bolt.lineTo(s * 0.04, -s * 0.04);
    bolt.lineTo(s * 0.18, -s * 0.22); bolt.close();
    const bfp = fp(ck, cfg.color);
    canvas.drawPath(bolt, bfp); bolt.delete(); bfp.delete();

  } else if (kind === 'Solar') {
    canvas.save();
    canvas.concat([1, -0.25, 0, 0, 1, 0, 0, 0, 1]);
    drawRRect(canvas, ck, -s * 0.36, -s * 0.25, s * 0.72, s * 0.5, s * 0.04, fillP);
    drawRRect(canvas, ck, -s * 0.36, -s * 0.25, s * 0.72, s * 0.5, s * 0.04, strokeP);
    const grid = new ck.Path();
    for (let i = 1; i < 4; i++) { const ox = -s * 0.36 + i * s * 0.18; grid.moveTo(ox, -s * 0.25); grid.lineTo(ox, s * 0.25); }
    grid.moveTo(-s * 0.36, 0); grid.lineTo(s * 0.36, 0);
    canvas.drawPath(grid, strokeP); grid.delete();
    canvas.restore();
    canvas.drawCircle(s * 0.30, -s * 0.32, s * 0.06, fp(ck, cfg.color));

  } else if (kind === 'CO2Asset') {
    drawRRect(canvas, ck, -s * 0.22, -s * 0.36, s * 0.44, s * 0.72, s * 0.10, fillP);
    drawRRect(canvas, ck, -s * 0.22, -s * 0.36, s * 0.44, s * 0.72, s * 0.10, strokeP);
    const cp = new ck.Path();
    cp.moveTo(-s * 0.06, -s * 0.36); cp.lineTo(-s * 0.06, -s * 0.44);
    cp.lineTo(s * 0.06, -s * 0.44); cp.lineTo(s * 0.06, -s * 0.36);
    canvas.drawPath(cp, strokeP); cp.delete();
    const textP = fp(ck, cfg.color);
    const font = new ck.Font(fonts.monoFace, s * 0.20);
    drawText(canvas, ck, 'CO2', 0, s * 0.02, textP, font, 'center', 'middle');
    font.delete(); textP.delete();

  } else if (kind === 'HeatNetwork') {
    drawRRect(canvas, ck, -s * 0.4, -s * 0.20, s * 0.8, s * 0.16, s * 0.06, fillP);
    drawRRect(canvas, ck, -s * 0.4, -s * 0.20, s * 0.8, s * 0.16, s * 0.06, strokeP);
    drawRRect(canvas, ck, -s * 0.4, s * 0.04, s * 0.8, s * 0.16, s * 0.06, fillP);
    drawRRect(canvas, ck, -s * 0.4, s * 0.04, s * 0.8, s * 0.16, s * 0.06, strokeP);
    const arrows = new ck.Path();
    arrows.moveTo(s * 0.14, -s * 0.20); arrows.lineTo(s * 0.30, -s * 0.12); arrows.lineTo(s * 0.14, -s * 0.04); arrows.close();
    arrows.moveTo(-s * 0.14, s * 0.20); arrows.lineTo(-s * 0.30, s * 0.12); arrows.lineTo(-s * 0.14, s * 0.04); arrows.close();
    const afp = fp(ck, cfg.color);
    canvas.drawPath(arrows, afp); arrows.delete(); afp.delete();

  } else {
    // Generic: rounded rect + short label
    drawRRect(canvas, ck, -s * 0.35, -s * 0.35, s * 0.7, s * 0.7, s * 0.1, fillP);
    drawRRect(canvas, ck, -s * 0.35, -s * 0.35, s * 0.7, s * 0.7, s * 0.1, strokeP);
  }

  fillP.delete();
  strokeP.delete();
  canvas.restore();
}

// ── Asset ──────────────────────────────────────────────────────────────────

function drawAsset(ck, canvas, fonts, it, selectedRefId, scale) {
  const { x, y, w, h } = it;
  const cfg = ASSET_KINDS[it.ref.Kind] || ASSET_KINDS.WKK;

  const f1 = fp(ck, '#ffffff');
  drawRRect(canvas, ck, x, y, w, h, 8, f1); f1.delete();
  const s1 = sp(ck, '#e2e8f0', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 8, s1); s1.delete();

  // Color bar
  const barF = fp(ck, cfg.color);
  drawRRect(canvas, ck, x, y, w, 6, 4, barF); barF.delete();
  const barRect = fp(ck, cfg.color);
  canvas.drawRect(ck.XYWHRect(x, y + 3, w, 3), barRect); barRect.delete();

  drawAssetIcon(ck, canvas, fonts, it.ref.Kind, x + w / 2, y + h / 2 - 6, Math.min(w, h) * 0.55);

  if (scale > 0.35) {
    const mono = fonts.mono;
    mono.setSize(9.5);
    const tagW = 36, tagH = 14;
    const tagF = fp(ck, cfg.tint);
    drawRRect(canvas, ck, x + 6, y + 10, tagW, tagH, 3, tagF); tagF.delete();
    const tagP = fp(ck, cfg.color);
    drawText(canvas, ck, cfg.short, x + 12, y + 17, tagP, mono, 'left', 'middle');
    tagP.delete();

    const sans = fonts.sans;
    sans.setSize(9.5);
    const nameP = fp(ck, '#0f172a');
    const clipped = clipText(sans, it.ref.Name || '', w - 16);
    drawText(canvas, ck, clipped, x + 8, y + h - 10, nameP, sans, 'left', 'middle');
    nameP.delete();
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Cap toggle ─────────────────────────────────────────────────────────────

function drawCapToggle(ck, canvas, fonts, it, expandedCaps, scale) {
  const { x, y, w, h } = it;
  const count = (it.ref.Capacities || []).length;
  const expanded = expandedCaps.has(it.ref.Id);

  const f1 = fp(ck, '#e2e8f0');
  drawRRect(canvas, ck, x, y, w, h, 0, f1); f1.delete();
  const s1 = sp(ck, '#cbd5e1', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 0, s1); s1.delete();

  if (scale > 0.3) {
    const mono = fonts.mono;
    mono.setSize(8);
    const tp = fp(ck, '#64748b');
    const txt = `${expanded ? '^' : 'v'} ${count} profiel${count !== 1 ? 'en' : ''}`;
    drawText(canvas, ck, txt, x + w / 2, y + h / 2, tp, mono, 'center', 'middle');
    tp.delete();
  }
}

// ── Capacity ───────────────────────────────────────────────────────────────

function drawCapacity(ck, canvas, fonts, it, selectedRefId, scale) {
  const { x, y, w, h } = it;
  const pad = 6;

  const f1 = fp(ck, '#f8fafc');
  drawRRect(canvas, ck, x, y, w, h, 4, f1); f1.delete();
  const s1 = sp(ck, '#cbd5e1', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 4, s1); s1.delete();

  if (scale > 0.35) {
    const mono = fonts.mono;
    mono.setSize(9);
    const nameP = fp(ck, '#475569');
    const clipped = clipText(mono, it.ref.Name || '', w - 2 * pad);
    drawText(canvas, ck, clipped, x + pad, y + pad, nameP, mono, 'left', 'top');
    nameP.delete();

    const chips = [];
    if (it.ref.ElectricityProduction) chips.push({ txt: `E ${it.ref.ElectricityProduction > 0 ? '+' : ''}${Math.round(it.ref.ElectricityProduction)}`, col: '#1d4ed8' });
    if (it.ref.HeatProduction) chips.push({ txt: `H +${Math.round(it.ref.HeatProduction)}`, col: '#b91c1c' });
    if (it.ref.CO2Production) chips.push({ txt: `CO2 +${Math.round(it.ref.CO2Production)}`, col: '#15803d' });
    if (it.ref.GasUsage) chips.push({ txt: `G ${Math.round(it.ref.GasUsage)}`, col: '#b45309' });

    const chipY = y + pad + 11 + 4;
    const chipH = 12;
    mono.setSize(7.5);
    let cx = x + pad;
    chips.forEach(chip => {
      const tw = measureWidth(mono, chip.txt) + 6;
      if (cx + tw > x + w - pad) return;
      const chipF = fp(ck, chip.col, 0.13);
      drawRRect(canvas, ck, cx, chipY, tw, chipH, 2, chipF); chipF.delete();
      const chipP = fp(ck, chip.col);
      drawText(canvas, ck, chip.txt, cx + 3, chipY + chipH / 2, chipP, mono, 'left', 'middle');
      chipP.delete();
      cx += tw + 3;
    });
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Buffer ─────────────────────────────────────────────────────────────────

function drawBuffer(ck, canvas, fonts, it, selectedRefId, scale) {
  const { x, y, w, h } = it;
  const cfg = BUFFER_KINDS[it.ref.Kind] || BUFFER_KINDS.Heat;
  const r = h / 2;

  // Cylinder left ellipse
  const ef1 = fp(ck, cfg.tint);
  canvas.drawOval(ck.XYWHRect(x, y, r * 1.1, h), ef1); ef1.delete();
  const es1 = sp(ck, cfg.color, 1, 1 / scale);
  canvas.drawOval(ck.XYWHRect(x, y, r * 1.1, h), es1); es1.delete();

  // Body rect (cover up middle ellipse edges)
  const bodyF = fp(ck, cfg.tint);
  canvas.drawRect(ck.XYWHRect(x + r * 0.55, y, w - r * 1.1, h), bodyF); bodyF.delete();

  // Top/bottom lines
  const edgeS = sp(ck, cfg.color, 1, 1 / scale);
  const edgePath = new ck.Path();
  edgePath.moveTo(x + r * 0.55, y); edgePath.lineTo(x + w - r * 0.55, y);
  edgePath.moveTo(x + r * 0.55, y + h); edgePath.lineTo(x + w - r * 0.55, y + h);
  canvas.drawPath(edgePath, edgeS); edgePath.delete(); edgeS.delete();

  // Right cap ellipse (white)
  const ef2 = fp(ck, '#ffffff');
  canvas.drawOval(ck.XYWHRect(x + w - r * 1.1, y, r * 1.1, h), ef2); ef2.delete();
  const es2 = sp(ck, cfg.color, 1, 1 / scale);
  canvas.drawOval(ck.XYWHRect(x + w - r * 1.1, y, r * 1.1, h), es2); es2.delete();

  // Diagonal fill stripes inside body
  if (scale > 0.3) {
    canvas.save();
    const clipPath = new ck.Path();
    clipPath.moveTo(x + r * 0.55, y); clipPath.lineTo(x + w - r * 0.55, y);
    clipPath.lineTo(x + w - r * 0.55, y + h); clipPath.lineTo(x + r * 0.55, y + h); clipPath.close();
    canvas.clipPath(clipPath, ck.ClipOp.Intersect, false);
    clipPath.delete();
    const strP = sp(ck, cfg.color, 0.2, 1 / scale);
    const strPath = new ck.Path();
    for (let i = -h; i < w; i += 8) { strPath.moveTo(x + i, y + h); strPath.lineTo(x + i + h, y); }
    canvas.drawPath(strPath, strP); strPath.delete(); strP.delete();
    canvas.restore();
  }

  // Top pipe nub
  const nubF = fp(ck, cfg.color);
  canvas.drawRect(ck.XYWHRect(x + w * 0.5 - 6, y - 6, 12, 6), nubF); nubF.delete();

  if (scale > 0.32) {
    const mono = fonts.mono;
    const sans = fonts.sans;
    mono.setSize(10);
    const labelP = fp(ck, cfg.color);
    drawText(canvas, ck, it.ref.Kind === 'CO2' ? 'CO2-BUFFER' : 'WARMTEBUFFER', x + r * 0.55 + 8, y + 6, labelP, mono, 'left', 'top');
    labelP.delete();
    sans.setSize(12);
    const nameP = fp(ck, '#0f172a');
    const clipped = clipText(sans, it.ref.Name || '', w - 2 * r - 16);
    drawText(canvas, ck, clipped, x + r * 0.55 + 8, y + 20, nameP, sans, 'left', 'top');
    nameP.delete();
    mono.setSize(15);
    const volP = fp(ck, '#0f172a');
    drawText(canvas, ck, Number(it.ref.Volume || 0).toLocaleString('nl-NL'), x + w - r * 0.55 - 4, y + 18, volP, mono, 'right', 'top');
    volP.delete();
    mono.setSize(9);
    const unitP = fp(ck, cfg.color);
    drawText(canvas, ck, 'm3', x + w - r * 0.55 - 4, y + 38, unitP, mono, 'right', 'top');
    unitP.delete();
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Connection (gas / elec) ────────────────────────────────────────────────

function drawConnection(ck, canvas, fonts, it, kind, selectedRefId, scale) {
  const { x, y, w, h } = it;
  const color = kind === 'gas' ? '#b45309' : '#1d4ed8';
  const tint = kind === 'gas' ? '#fef3c7' : '#dbeafe';
  const label = kind === 'gas' ? 'GAS  AANSLUITING' : 'ELEK  AANSLUITING';

  const f1 = fp(ck, '#ffffff');
  drawRRect(canvas, ck, x, y, w, h, 8, f1); f1.delete();
  const s1 = sp(ck, '#e2e8f0', 1, 1 / scale);
  drawRRect(canvas, ck, x, y, w, h, 8, s1); s1.delete();

  const barF = fp(ck, tint);
  drawRRect(canvas, ck, x, y, 8, h, 4, barF); barF.delete();
  const barR = fp(ck, tint);
  canvas.drawRect(ck.XYWHRect(x + 4, y, 4, h), barR); barR.delete();

  if (scale > 0.3) {
    const mono = fonts.mono;
    const sans = fonts.sans;
    mono.setSize(9);
    const labelP = fp(ck, color);
    drawText(canvas, ck, label, x + 16, y + 8, labelP, mono, 'left', 'top');
    labelP.delete();
    sans.setSize(11);
    const nameP = fp(ck, '#0f172a');
    const clipped = clipText(sans, it.ref.Name || '', w - 24);
    drawText(canvas, ck, clipped, x + 16, y + 22, nameP, sans, 'left', 'top');
    nameP.delete();
    mono.setSize(9);
    const aps = (it.ref.AllocationPoints || []).length;
    const subP = fp(ck, '#94a3b8');
    drawText(canvas, ck, `${aps} allocatiepunt${aps !== 1 ? 'en' : ''}`, x + 16, y + 38, subP, mono, 'left', 'top');
    subP.delete();
  }

  drawSelectIfMatch(ck, canvas, it, selectedRefId, scale);
}

// ── Pipes between assets and buffers ──────────────────────────────────────

function drawPipe(ck, canvas, x1, y1, x2, y2, color, scale) {
  const midY = (y1 + y2) / 2 + 12;

  const thickP = sp(ck, color, 0.33, Math.max(2 / scale, 4));
  thickP.setStrokeCap(ck.StrokeCap.Round);
  const path1 = new ck.Path();
  path1.moveTo(x1, y1); path1.cubicTo(x1, midY, x2, midY, x2, y2);
  canvas.drawPath(path1, thickP); path1.delete(); thickP.delete();

  const dashP = sp(ck, color, 1, Math.max(1 / scale, 1.5));
  const dashEffect = ck.PathEffect.MakeDash([3, 4], 0);
  dashP.setPathEffect(dashEffect);
  const path2 = new ck.Path();
  path2.moveTo(x1, y1); path2.cubicTo(x1, midY, x2, midY, x2, y2);
  canvas.drawPath(path2, dashP); path2.delete(); dashP.delete(); dashEffect.delete();
}

export function drawConnections(ck, canvas, items) {
  const byKind = k => items.filter(it => it.kind === k);
  const assets = byKind('asset');
  const buffers = byKind('buffer');
  const greenhouses = byKind('greenhouse');
  const scale = 1; // called in world space

  assets.forEach(a => {
    const buf = a.ref.BufferId ? buffers.find(b => b.ref.Id === a.ref.BufferId) : null;
    if (!buf) return;
    const flow = ASSET_BUFFER_FLOW[a.ref.Kind];
    const color = flow === 'co2' ? '#15803d' : '#b91c1c';
    const ax = a.x + a.w / 2, ay = a.y + a.h;
    const targetX = Math.max(buf.x + buf.h / 2, Math.min(buf.x + buf.w - buf.h / 2, ax));
    drawPipe(ck, canvas, ax, ay, targetX, buf.y, color, scale);
  });

  buffers.forEach(buf => {
    const cfg = BUFFER_KINDS[buf.ref.Kind] || BUFFER_KINDS.Heat;
    const bx = buf.x + buf.w / 2, by = buf.y;
    (buf.ref.GreenhouseIds || []).forEach(ghId => {
      const gh = greenhouses.find(g => g.ref.Id === ghId);
      if (!gh) return;
      drawPipe(ck, canvas, bx, by, gh.x + gh.w / 2, gh.y + gh.h, cfg.color, scale);
    });
  });
}

// ── Relation lines ─────────────────────────────────────────────────────────

function drawRelationLine(ck, canvas, x1, y1, x2, y2, connKind, scale) {
  const color = connKind === 'gas' ? '#b45309' : '#1d4ed8';
  const lw = Math.max(1 / scale, 1.5);

  const glowP = sp(ck, color, 0.2, lw * 4);
  const glow = new ck.Path(); glow.moveTo(x1, y1); glow.lineTo(x2, y2);
  canvas.drawPath(glow, glowP); glow.delete(); glowP.delete();

  const dashP = sp(ck, color, 0.8, lw);
  const de = ck.PathEffect.MakeDash([5, 4], 0);
  dashP.setPathEffect(de);
  const core = new ck.Path(); core.moveTo(x1, y1); core.lineTo(x2, y2);
  canvas.drawPath(core, dashP); core.delete(); dashP.delete(); de.delete();

  // Arrow at asset end
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const as = Math.max(7 / scale, 9);
  const arrowF = fp(ck, color, 0.8);
  const arrow = new ck.Path();
  arrow.moveTo(x2, y2);
  arrow.lineTo(x2 - as * Math.cos(ang - Math.PI / 6), y2 - as * Math.sin(ang - Math.PI / 6));
  arrow.lineTo(x2 - as * Math.cos(ang + Math.PI / 6), y2 - as * Math.sin(ang + Math.PI / 6));
  arrow.close();
  canvas.drawPath(arrow, arrowF); arrow.delete(); arrowF.delete();

  // Source dot
  const dotF = fp(ck, color, 0.6);
  canvas.drawCircle(x1, y1, Math.max(3 / scale, 4), dotF); dotF.delete();
}

export function drawRelationLines(ck, canvas, items, visibleRelations, scale) {
  if (!visibleRelations.size) return;
  for (const [id, payload] of visibleRelations) {
    let connItem = null, aps = [], connKind = 'gas';
    if (payload.kind === 'allocationpoint') {
      connKind = payload.parents.connKind || 'gas';
      const conn = payload.parents.conn;
      if (!conn) continue;
      connItem = items.find(it => (connKind === 'gas' ? it.kind === 'gasconn' : it.kind === 'elecconn') && it.ref.Id === conn.Id);
      aps = [payload.ref];
    } else if (payload.kind === 'gasconn' || payload.kind === 'elecconn') {
      connKind = payload.kind === 'gasconn' ? 'gas' : 'elec';
      connItem = items.find(it => it.kind === payload.kind && it.ref.Id === payload.ref.Id);
      aps = payload.ref.AllocationPoints || [];
    } else continue;
    if (!connItem) continue;
    const cx = connItem.x + connItem.w / 2, cy = connItem.y;
    for (const ap of aps) {
      for (const aid of (ap.AssetIds || [])) {
        const aItem = items.find(it => it.kind === 'asset' && it.ref.Id === aid);
        if (!aItem) continue;
        drawRelationLine(ck, canvas, cx, cy, aItem.x + aItem.w / 2, aItem.y + aItem.h, connKind, scale);
      }
    }
  }
}

// ── Main draw frame ────────────────────────────────────────────────────────

export function drawFrame(ck, canvas, fonts, location, appState, screenW, screenH) {
  canvas.clear(ck.Color4f(0.953, 0.961, 0.973, 1));
  drawGrid(ck, canvas, appState.view, screenW, screenH);

  if (!location) return [];

  const layout = buildLayout(location, appState.expandedCaps);
  const { items } = layout;
  const { scale } = appState.view;
  const { selected, visibleRelations } = appState;
  const selectedRefId = selected?.refId ?? null;

  canvas.save();
  canvas.translate(appState.view.x, appState.view.y);
  canvas.scale(scale, scale);

  items.filter(it => it.kind === 'location').forEach(it => drawLocation(ck, canvas, fonts, it, selectedRefId, scale));
  items.filter(it => it.kind === 'greenhouse').forEach(it => drawGreenhouse(ck, canvas, fonts, it, selectedRefId, scale));
  drawConnections(ck, canvas, items);
  items.forEach(it => {
    switch (it.kind) {
      case 'asset':      drawAsset(ck, canvas, fonts, it, selectedRefId, scale); break;
      case 'cap-toggle': drawCapToggle(ck, canvas, fonts, it, appState.expandedCaps, scale); break;
      case 'capacity':   drawCapacity(ck, canvas, fonts, it, selectedRefId, scale); break;
      case 'buffer':     drawBuffer(ck, canvas, fonts, it, selectedRefId, scale); break;
      case 'gasconn':    drawConnection(ck, canvas, fonts, it, 'gas', selectedRefId, scale); break;
      case 'elecconn':   drawConnection(ck, canvas, fonts, it, 'elec', selectedRefId, scale); break;
    }
  });
  drawRelationLines(ck, canvas, items, visibleRelations, scale);

  canvas.restore();
  return items;
}
