/*
 * Vox Pop - art.js
 * Everything in the world is drawn here with canvas paths: ground tiles, buildings, props,
 * people, sheep and the little markers that float above them. No image files.
 * World pixels: a tile (x, y) sits at ((x - y) * 32, (x + y) * 16); z goes up the screen.
 */
(function () {
  'use strict';
  const VP = (window.VP = window.VP || {});
  const Wd = VP.World;
  const HT = Wd.TW / 2, HH = Wd.TH / 2;

  /* ------------------------------------------------------------ colour helpers */
  const cache = new Map();
  function rgbOf(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const css = (r, g, b, a) => (a == null ? 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')' : 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')');
  /** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
  function shade(h, amt) {
    const k = h + '|' + amt;
    let v = cache.get(k);
    if (v) return v;
    const [r, g, b] = rgbOf(h);
    v = amt < 0 ? css(r * (1 + amt), g * (1 + amt), b * (1 + amt)) : css(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    cache.set(k, v);
    return v;
  }
  function mix(h1, h2, t) {
    const a = rgbOf(h1), b = rgbOf(h2);
    return css(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  // deterministic per-tile noise
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------ geometry helpers */
  const P = (x, y, z) => [(x - y) * HT, (x + y) * HH - (z || 0)];
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  /** Axis-aligned box. Returns face helpers for details. */
  function box(ctx, x0, y0, x1, y1, z, h, top, left, right) {
    const a = P(x0, y1, z), b = P(x1, y1, z), c = P(x1, y0, z);
    const a2 = P(x0, y1, z + h), b2 = P(x1, y1, z + h), c2 = P(x1, y0, z + h), d2 = P(x0, y0, z + h);
    if (left) poly(ctx, [a, b, b2, a2], left);
    if (right) poly(ctx, [b, c, c2, b2], right);
    if (top) poly(ctx, [d2, c2, b2, a2], top);
  }
  // A point on the south face (y = y1) at fraction u from west to east, height v; or the east face (x = x1) from south (u = 0) to north.
  const onS = (b, u, v) => P(b.x0 + (b.x1 - b.x0) * u, b.y1, v);
  const onE = (b, u, v) => P(b.x1, b.y1 - (b.y1 - b.y0) * u, v);
  function quad(ctx, face, b, u0, u1, v0, v1, fill, stroke) {
    poly(ctx, [face(b, u0, v0), face(b, u1, v0), face(b, u1, v1), face(b, u0, v1)], fill, stroke);
  }
  /** Text painted onto the south (skew +0.5) or east (skew -0.5) face. */
  function faceText(ctx, face, b, u, v, text, font, color, align) {
    const o = face(b, u, v);
    ctx.save();
    ctx.translate(o[0], o[1]);
    ctx.transform(1, face === onS ? 0.5 : -0.5, 0, 1, 0, 0);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /* ------------------------------------------------------------ palette */
  const C = {
    grass: '#86BD5B', heather: '#93A866', road: '#6B7277', pave: '#D7D1C5', water: '#4A9CC0', bridge: '#B6AC9C',
    field: '#9CC76A', crop: '#A99058', bog: '#6E5238', concrete: '#CCD2D6', pitch: '#6DBF52', dirt: '#BC9F70',
    soil: '#7A5A3E', soilDark: '#5B4230', rock: '#9AA0A4', glass: '#BFD9E6', glassNight: '#FFD27A',
    ink: '#241C17', coat: '#FFC933', coatDark: '#D9A21A', opinion: '#9B3D8F', data: '#00727C',
  };
  const ART = { C, shade, mix, P, poly, circle, ellipse, rrect, box, hash };

  /* ============================================================ GROUND */
  function tileFill(t, x, y) {
    const n = hash(x, y, 1) - 0.5;
    switch (t) {
      case 'grass': return shade(C.grass, n * 0.1);
      case 'heather': return shade(C.heather, n * 0.12);
      case 'field': return shade(C.field, (x % 2 ? 0.04 : -0.03));
      case 'pitch': return shade(C.pitch, (x % 2 ? 0.06 : -0.02));
      case 'crop': return shade(C.crop, n * 0.08);
      case 'bog': return shade(C.bog, n * 0.12);
      case 'water': return shade(C.water, n * 0.05);
      default: return shade(C[t] || C.grass, n * 0.04);
    }
  }
  const isRoad = (x, y) => x >= 0 && y >= 0 && x < Wd.W && y < Wd.H && (Wd.ground[y][x] === 'road' || Wd.ground[y][x] === 'bridge');

  function tileDetail(ctx, t, x, y) {
    const cx = x + 0.5, cy = y + 0.5;
    if (t === 'grass' || t === 'field') {
      ctx.strokeStyle = shade(t === 'grass' ? C.grass : C.field, -0.2);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const p = P(x + 0.15 + hash(x, y, i + 3) * 0.7, y + 0.15 + hash(x, y, i + 9) * 0.7);
        ctx.beginPath(); ctx.moveTo(p[0] - 2, p[1]); ctx.lineTo(p[0], p[1] - 3); ctx.lineTo(p[0] + 2, p[1]); ctx.stroke();
      }
      if (t === 'grass' && hash(x, y, 7) > 0.86) {
        const p = P(x + 0.3 + hash(x, y, 8) * 0.4, y + 0.3 + hash(x, y, 5) * 0.4);
        circle(ctx, p[0], p[1], 1.6, hash(x, y, 2) > 0.5 ? '#FFFFFF' : '#FFE066');
        circle(ctx, p[0] + 4, p[1] + 1, 1.3, '#FFFFFF');
      }
      if (t === 'field') { // mowing stripes along x
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        const a = P(x, y + 0.5), b = P(x + 1, y + 0.5);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    } else if (t === 'heather') {
      for (let i = 0; i < 6; i++) {
        const p = P(x + 0.1 + hash(x, y, i + 20) * 0.8, y + 0.1 + hash(x, y, i + 40) * 0.8);
        circle(ctx, p[0], p[1], 1.5 + hash(x, y, i) * 1.2, hash(x, y, i + 60) > 0.4 ? '#A3609A' : '#7E8F54');
      }
    } else if (t === 'road') {
      const alongX = isRoad(x - 1, y) || isRoad(x + 1, y), alongY = isRoad(x, y - 1) || isRoad(x, y + 1);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1.5;
      if (alongX && !alongY) { const a = P(x + 0.2, cy), b = P(x + 0.6, cy); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      else if (alongY && !alongX) { const a = P(cx, y + 0.2), b = P(cx, y + 0.6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    } else if (t === 'pave') {
      ctx.strokeStyle = 'rgba(120,110,95,.28)';
      ctx.lineWidth = 1;
      let a = P(x + 0.5, y), b = P(x + 0.5, y + 1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      a = P(x, y + 0.5); b = P(x + 1, y + 0.5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    } else if (t === 'water') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.2;
      const p = P(x + 0.3 + hash(x, y, 3) * 0.3, y + 0.3 + hash(x, y, 4) * 0.4);
      ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1]); ctx.quadraticCurveTo(p[0] - 3, p[1] - 2, p[0], p[1]); ctx.quadraticCurveTo(p[0] + 3, p[1] + 2, p[0] + 6, p[1]); ctx.stroke();
    } else if (t === 'crop') {
      ctx.strokeStyle = 'rgba(60,45,20,.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { const a = P(x + i / 4, y + 0.05), b = P(x + i / 4, y + 0.95); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { const p = P(x + 0.12 + hash(x, y, i) * 0.76, y + 0.1 + hash(x, y, i + 5) * 0.8); circle(ctx, p[0], p[1], 1.4, '#8FB356'); }
    } else if (t === 'bog') {
      for (let i = 0; i < 3; i++) { const p = P(x + 0.2 + hash(x, y, i) * 0.6, y + 0.2 + hash(x, y, i + 7) * 0.6); ellipse(ctx, p[0], p[1], 6, 2.5, 'rgba(40,28,18,.35)'); }
      for (let i = 0; i < 3; i++) { const p = P(x + 0.1 + hash(x, y, i + 11) * 0.8, y + 0.1 + hash(x, y, i + 13) * 0.8); circle(ctx, p[0], p[1] - 3, 1.5, '#F4F1E6'); ctx.fillStyle = '#6D7A3D'; ctx.fillRect(p[0] - 0.4, p[1] - 3, 0.8, 3); }
    } else if (t === 'concrete') {
      ctx.strokeStyle = 'rgba(90,100,110,.22)';
      ctx.lineWidth = 1;
      const a = P(x, y), b = P(x + 1, y), c = P(x, y + 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    } else if (t === 'dirt') {
      for (let i = 0; i < 3; i++) { const p = P(x + 0.15 + hash(x, y, i) * 0.7, y + 0.15 + hash(x, y, i + 3) * 0.7); circle(ctx, p[0], p[1], 1.1, 'rgba(90,70,40,.35)'); }
    } else if (t === 'bridge') {
      // low parapets on both long sides
      box(ctx, x, y, x + 1, y + 0.12, 0, 7, '#C8BFB0', '#A69C8C', '#978D7E');
      box(ctx, x, y + 0.88, x + 1, y + 1, 0, 7, '#C8BFB0', '#A69C8C', '#978D7E');
    }
  }

  /** Paint the whole ground (tiles, pitch lines, heat pipe, island edges) onto an offscreen canvas. */
  function renderGround(scale) {
    const minX = -Wd.H * HT - 4, maxX = Wd.W * HT + 4, minY = -8, maxY = (Wd.W + Wd.H) * HH + 60;
    const cw = Math.ceil((maxX - minX) * scale), ch = Math.ceil((maxY - minY) * scale);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
    ctx.lineJoin = 'round';

    // island sides first (they hang below the south-west and south-east edges)
    const D = 44;
    for (let x = 0; x < Wd.W; x++) {
      const t = Wd.ground[Wd.H - 1][x];
      const a = P(x, Wd.H), b = P(x + 1, Wd.H);
      const col = t === 'water' ? '#3F86A8' : C.soil;
      poly(ctx, [a, b, [b[0], b[1] + D], [a[0], a[1] + D]], col);
      poly(ctx, [a, b, [b[0], b[1] + 5], [a[0], a[1] + 5]], shade(tileFill(t, x, Wd.H - 1), -0.25));
      if (t !== 'water') { circle(ctx, a[0] + 12 + hash(x, 1, 2) * 20, a[1] + 20 + hash(x, 2, 2) * 14, 2.5, C.soilDark); }
      else { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(a[0] + 8, a[1] + 8); ctx.lineTo(a[0] + 8, a[1] + D - 4); ctx.moveTo(a[0] + 22, a[1] + 14); ctx.lineTo(a[0] + 22, a[1] + D); ctx.stroke(); }
    }
    for (let y = 0; y < Wd.H; y++) {
      const t = Wd.ground[y][Wd.W - 1];
      const a = P(Wd.W, y), b = P(Wd.W, y + 1);
      poly(ctx, [a, b, [b[0], b[1] + D], [a[0], a[1] + D]], t === 'water' ? '#357393' : C.soilDark);
      poly(ctx, [a, b, [b[0], b[1] + 5], [a[0], a[1] + 5]], shade(tileFill(t, Wd.W - 1, y), -0.35));
      circle(ctx, a[0] - 14 - hash(y, 3, 2) * 12, a[1] + 22 + hash(y, 4, 2) * 12, 2.5, '#4A3526');
    }

    // tiles
    for (let y = 0; y < Wd.H; y++) for (let x = 0; x < Wd.W; x++) {
      const t = Wd.ground[y][x];
      poly(ctx, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], tileFill(t, x, y));
    }
    // soft shore lines along the river
    for (let y = 0; y < Wd.H; y++) {
      if (Wd.ground[y][9] === 'water') { const a = P(9, y), b = P(9, y + 1); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      if (Wd.ground[y][10] === 'water') { const a = P(11, y), b = P(11, y + 1); ctx.strokeStyle = 'rgba(40,60,40,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    for (let y = 0; y < Wd.H; y++) for (let x = 0; x < Wd.W; x++) tileDetail(ctx, Wd.ground[y][x], x, y);

    // GAA pitch markings
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.6;
    const line = (a, b) => { const p = P(a[0], a[1]), q = P(b[0], b[1]); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
    const px0 = 11.2, px1 = 18.8, py0 = 23.2, py1 = 30.8;
    line([px0, py0], [px1, py0]); line([px1, py0], [px1, py1]); line([px1, py1], [px0, py1]); line([px0, py1], [px0, py0]);
    line([px0, 27], [px1, 27]);
    line([px0, 24.6], [px1, 24.6]); line([px0, 29.4], [px1, 29.4]);
    line([13.6, py0], [13.6, 23.9]); line([13.6, 23.9], [15.4, 23.9]); line([15.4, 23.9], [15.4, py0]);
    line([13.6, py1], [13.6, 30.1]); line([13.6, 30.1], [15.4, 30.1]); line([15.4, 30.1], [15.4, py1]);

    // zebra crossing on Main Street by the bus stop
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 4; i++) poly(ctx, [P(15.12 + i * 0.2, 15.05), P(15.22 + i * 0.2, 15.05), P(15.22 + i * 0.2, 15.95), P(15.12 + i * 0.2, 15.95)], 'rgba(255,255,255,.8)');

    // heat pipe
    Wd.heatPipe.manholes.forEach((m) => { const p = P(m[0], m[1]); ellipse(ctx, p[0], p[1], 7, 3.5, '#4D5358'); ellipse(ctx, p[0], p[1], 5, 2.4, '#6C7378'); });
    Wd.heatPipe.runs.forEach((run) => {
      for (let i = 0; i < run.length - 1; i++) {
        const a = run[i], b = run[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0.3; s < len; s += 0.6) { const q = P(a[0] + (b[0] - a[0]) * s / len, a[1] + (b[1] - a[1]) * s / len); ctx.fillStyle = '#39413C'; ctx.fillRect(q[0] - 1, q[1] - 6, 2, 6); }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      run.forEach((pt, i) => { const q = P(pt[0], pt[1], 7); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.strokeStyle = '#2E6E4E'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    return { canvas: cv, ox: minX, oy: minY, scale };
  }

  /* ============================================================ BUILDINGS */
  const ROOF_FLAT = '#8E8E8A';
  function windowCol(env) { return env.evening > 0.35 ? mix(C.glass, C.glassNight, Math.min(1, (env.evening - 0.35) * 2)) : C.glass; }

  function gableRoof(ctx, b, top, rh, col, axis) {
    const over = 0.08;
    const x0 = b.x0 - over, x1 = b.x1 + over, y0 = b.y0 - over, y1 = b.y1 + over;
    if (axis === 'x') {
      const ym = (b.y0 + b.y1) / 2;
      poly(ctx, [P(x0, y0, top), P(x1, y0, top), P(x1, ym, top + rh), P(x0, ym, top + rh)], shade(col, -0.2));
      poly(ctx, [P(x0, ym, top + rh), P(x1, ym, top + rh), P(x1, y1, top), P(x0, y1, top)], col);
      poly(ctx, [P(b.x1, b.y0, top), P(b.x1, b.y1, top), P(b.x1, ym, top + rh)], shade(b.wall, -0.18));
      ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1;
      const r0 = P(x0, ym, top + rh), r1 = P(x1, ym, top + rh); ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
    } else {
      const xm = (b.x0 + b.x1) / 2;
      poly(ctx, [P(x0, y0, top), P(xm, y0, top + rh), P(xm, y1, top + rh), P(x0, y1, top)], shade(col, 0.08));
      poly(ctx, [P(xm, y0, top + rh), P(x1, y0, top), P(x1, y1, top), P(xm, y1, top + rh)], shade(col, -0.18));
      poly(ctx, [P(b.x0, b.y1, top), P(b.x1, b.y1, top), P(xm, b.y1, top + rh)], b.wall);
      ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1;
      const r0 = P(xm, y0, top + rh), r1 = P(xm, y1, top + rh); ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
    }
  }

  function drawBuilding(ctx, b, env) {
    const wall = b.wall;
    const L = shade(wall, -0.06), R = shade(wall, -0.22);
    const win = windowCol(env);
    // contact shadow
    poly(ctx, [P(b.x0 - 0.05, b.y1 + 0.18), P(b.x1 + 0.18, b.y1 + 0.18), P(b.x1 + 0.18, b.y0 - 0.05), P(b.x1, b.y0), P(b.x1, b.y1), P(b.x0, b.y1)], 'rgba(30,40,30,.16)');

    if (b.style === 'dc') return drawDataHall(ctx, b, env);
    if (b.style === 'substation') return drawSubstation(ctx, b, env);
    if (b.style === 'spire') {
      box(ctx, b.x0 + 0.1, b.y0 + 0.1, b.x1 - 0.1, b.y1 - 0.1, 0, b.h, shade(wall, 0.1), L, R);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, top = b.h;
      poly(ctx, [P(b.x0 + 0.1, b.y1 - 0.1, top), P(b.x1 - 0.1, b.y1 - 0.1, top), P(cx, cy, top + 58)], shade(b.roofCol, 0.1));
      poly(ctx, [P(b.x1 - 0.1, b.y1 - 0.1, top), P(b.x1 - 0.1, b.y0 + 0.1, top), P(cx, cy, top + 58)], shade(b.roofCol, -0.15));
      const tip = P(cx, cy, top + 58); ctx.strokeStyle = '#3B3F45'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0], tip[1] - 9); ctx.moveTo(tip[0] - 3, tip[1] - 6); ctx.lineTo(tip[0] + 3, tip[1] - 6); ctx.stroke();
      quad(ctx, onS, b, 0.35, 0.65, b.h - 34, b.h - 18, '#3E3A36');
      quad(ctx, onE, b, 0.35, 0.65, b.h - 34, b.h - 18, '#34302C');
      return;
    }

    box(ctx, b.x0, b.y0, b.x1, b.y1, 0, b.h, b.roof === 'flat' ? ROOF_FLAT : null, L, R);
    const wS = b.x1 - b.x0, wE = b.y1 - b.y0;

    if (b.style === 'shop') {
      // shopfront on the south face: sign band, big window, door
      quad(ctx, onS, b, 0.04, 0.96, b.h - 16, b.h - 5, shade(wall, -0.35));
      if (b.sign) faceText(ctx, onS, b, 0.5, b.h - 10.5, b.sign, '700 8px Figtree, system-ui, sans-serif', '#FFFFFF');
      quad(ctx, onS, b, 0.08, 0.58, 6, 26, win, 'rgba(0,0,0,.25)');
      quad(ctx, onS, b, 0.68, 0.88, 0, 26, shade(wall, -0.45));
      // upstairs windows
      for (let i = 0; i < wS; i++) quad(ctx, onS, b, (i + 0.25) / wS, (i + 0.7) / wS, 32, b.h - 22, win, 'rgba(255,255,255,.6)');
      for (let i = 0; i < wE; i++) quad(ctx, onE, b, (i + 0.3) / wE, (i + 0.7) / wE, 32, b.h - 22, win, 'rgba(255,255,255,.5)');
      // parapet
      box(ctx, b.x0, b.y1 - 0.08, b.x1, b.y1, b.h, 4, shade(wall, 0.15), shade(wall, 0.05), shade(wall, -0.1));
      box(ctx, b.x1 - 0.08, b.y0, b.x1, b.y1, b.h, 4, shade(wall, 0.15), shade(wall, 0.05), shade(wall, -0.1));
      return;
    }
    if (b.style === 'energy') {
      quad(ctx, onS, b, 0.1, 0.9, b.h - 14, b.h - 5, '#2E6E4E');
      faceText(ctx, onS, b, 0.5, b.h - 9.5, 'Energy centre', '700 7px Figtree, system-ui, sans-serif', '#FFFFFF');
      quad(ctx, onS, b, 0.15, 0.4, 0, 22, '#4F6B60');
      for (let i = 0; i < 3; i++) quad(ctx, onE, b, 0.15 + i * 0.28, 0.33 + i * 0.28, 12, 24, '#6F958A');
      // flue stack
      const s = P(b.x0 + 0.5, b.y0 + 0.5, b.h);
      ctx.fillStyle = '#B9C2BE'; ctx.fillRect(s[0] - 4, s[1] - 26, 8, 26);
      ellipse(ctx, s[0], s[1] - 26, 4, 2, '#8A9490');
      if (!env.reduced) { const k = (env.t * 0.6) % 1; circle(ctx, s[0] + k * 6, s[1] - 32 - k * 18, 3 + k * 4, 'rgba(255,255,255,' + (0.5 - k * 0.5) + ')'); }
      return;
    }
    if (b.style === 'house' || b.style === 'farmhouse' || b.style === 'hall' || b.style === 'barn' || b.style === 'church') {
      if (b.style === 'barn') {
        for (let i = 1; i < 8; i++) { const a = onS(b, i / 8, 0), c = onS(b, i / 8, b.h); ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
        quad(ctx, onS, b, 0.3, 0.7, 0, b.h - 8, '#7C2C2A');
      } else if (b.style === 'church') {
        for (let i = 0; i < wE; i++) {
          const u0 = (i + 0.35) / wE, u1 = (i + 0.65) / wE;
          quad(ctx, onE, b, u0, u1, 16, 40, env.evening > 0.4 ? '#F2C66A' : '#7E93B8');
          const tp = onE(b, (u0 + u1) / 2, 44); circle(ctx, tp[0], tp[1], 3.5, env.evening > 0.4 ? '#F2C66A' : '#7E93B8');
        }
        quad(ctx, onS, b, 0.38, 0.62, 0, 30, '#5B3F2E');
        const tp = onS(b, 0.5, 30); circle(ctx, tp[0], tp[1] - 1, 5.5, '#5B3F2E');
      } else {
        // door + windows
        const door = b.style === 'farmhouse' ? '#B8322A' : shade(b.wall, -0.5);
        quad(ctx, onS, b, 0.42, 0.58, 0, 22, door);
        for (let i = 0; i < wS; i++) {
          if (i === Math.floor(wS / 2) && b.style !== 'hall') continue;
          quad(ctx, onS, b, (i + 0.2) / wS, (i + 0.5) / wS, 10, 24, win, '#FFFFFF');
        }
        quad(ctx, onS, b, 0.15, 0.4, 30, 40, win, '#FFFFFF');
        quad(ctx, onS, b, 0.6, 0.85, 30, 40, win, '#FFFFFF');
        for (let i = 0; i < wE; i++) quad(ctx, onE, b, (i + 0.3) / wE, (i + 0.7) / wE, 12, 26, win, '#FFFFFF');
        if (b.sign) { quad(ctx, onS, b, 0.1, 0.9, b.h - 13, b.h - 4, '#3F6B5A'); faceText(ctx, onS, b, 0.5, b.h - 8.5, b.sign, '700 7px Figtree, system-ui, sans-serif', '#FFFFFF'); }
      }
      const axis = b.roof === 'gable-x' ? 'x' : 'y';
      const rh = b.style === 'church' ? 34 : b.style === 'hall' ? 18 : 22;
      gableRoof(ctx, b, b.h, rh, b.roofCol || '#555B63', axis);
      if (b.style === 'house' || b.style === 'farmhouse') {
        // chimney
        const cx = axis === 'x' ? b.x0 + 0.35 : (b.x0 + b.x1) / 2, cy = axis === 'x' ? (b.y0 + b.y1) / 2 : b.y0 + 0.35;
        box(ctx, cx - 0.12, cy - 0.12, cx + 0.12, cy + 0.12, b.h + rh - 6, 16, '#8A8480', shade(b.wall, -0.2), shade(b.wall, -0.35));
      }
      return;
    }
  }

  function drawDataHall(ctx, b, env) {
    const L = '#D3DAE1', R = '#B4BEC8', T = '#ECEFF2';
    box(ctx, b.x0, b.y0, b.x1, b.y1, 0, b.h, T, L, R);
    // louvre stripes
    ctx.strokeStyle = 'rgba(80,95,110,.28)';
    ctx.lineWidth = 1;
    const nS = (b.x1 - b.x0) * 6, nE = (b.y1 - b.y0) * 6;
    for (let i = 1; i < nS; i++) { const a = onS(b, i / nS, 8), c = onS(b, i / nS, b.h - 14); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
    for (let i = 1; i < nE; i++) { const a = onE(b, i / nE, 8), c = onE(b, i / nE, b.h - 14); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
    // teal band + status lights
    quad(ctx, onS, b, 0, 1, b.h - 12, b.h - 6, '#1F8A8F');
    quad(ctx, onE, b, 0, 1, b.h - 12, b.h - 6, '#17767A');
    for (let i = 0; i < 10; i++) {
      const on = env.reduced ? i % 3 !== 0 : Math.sin(env.t * 3 + i * 1.7 + b.x0) > -0.2;
      const p = onE(b, (i + 0.5) / 10, 4);
      circle(ctx, p[0], p[1], 1.2, on ? '#7CFFB2' : '#2F5D4A');
    }
    if (b.door) {
      quad(ctx, onS, b, b.door - 0.07, b.door + 0.07, 0, 26, '#40525F');
      quad(ctx, onS, b, b.door - 0.055, b.door + 0.055, 2, 24, '#8FB4C9');
      faceText(ctx, onS, b, 0.5, b.h - 25, 'BALLINACLOUD DATA CAMPUS', '800 9px Figtree, system-ui, sans-serif', '#35505E');
      faceText(ctx, onS, b, b.door, 32, 'Data hall B · visitors', '700 6.5px Figtree, system-ui, sans-serif', '#35505E');
    }
    // rooftop chillers with fans
    const cols = b.x1 - b.x0 - 1, rows = b.y1 - b.y0 - 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = b.x0 + 0.6 + i, y = b.y0 + 0.6 + j;
      box(ctx, x, y, x + 0.8, y + 0.8, b.h, 7, '#C3CBD2', '#A7B1BA', '#95A0AA');
      const c = P(x + 0.4, y + 0.4, b.h + 7);
      ellipse(ctx, c[0], c[1], 9, 4.5, '#6E7B86');
      if (!env.reduced) {
        const a = env.t * 8 + i + j;
        ctx.strokeStyle = '#C3CBD2'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(c[0] + Math.cos(a) * 8, c[1] + Math.sin(a) * 4); ctx.lineTo(c[0] - Math.cos(a) * 8, c[1] - Math.sin(a) * 4); ctx.stroke();
      }
    }
  }

  function drawSubstation(ctx, b, env) {
    poly(ctx, [P(b.x0, b.y0, 0), P(b.x1, b.y0, 0), P(b.x1, b.y1, 0), P(b.x0, b.y1, 0)], '#B8B3A8');
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = b.x0 + 0.2 + i, y = b.y0 + 0.25 + j * 0.9;
      box(ctx, x, y, x + 0.55, y + 0.45, 0, 20, '#8E979E', '#A4ADB4', '#7E878E');
      for (let k = 0; k < 3; k++) {
        const p = P(x + 0.12 + k * 0.16, y + 0.2, 20);
        ctx.fillStyle = '#6A4E3A'; ctx.fillRect(p[0] - 1, p[1] - 12, 2, 12);
        circle(ctx, p[0], p[1] - 12, 2, '#D8D0C4');
      }
    }
    // warning sign
    const s = P(b.x0 + 0.1, b.y1, 12);
    poly(ctx, [[s[0], s[1] - 8], [s[0] + 7, s[1] + 4], [s[0] - 7, s[1] + 4]], '#FFD23F', '#241C17');
    ctx.fillStyle = '#241C17'; ctx.font = '800 7px Figtree, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', s[0], s[1] + 3);
  }

  /* ============================================================ PROPS */
  function drawProp(ctx, p, env) {
    const cx = p.x + 0.5, cy = p.y + 0.5;
    const g = P(cx, cy);
    switch (p.kind) {
      case 'tree': {
        ellipse(ctx, g[0] + 4, g[1] + 2, 16, 7, 'rgba(30,50,20,.2)');
        ctx.fillStyle = '#6B4A2E'; ctx.fillRect(g[0] - 2.5, g[1] - 22, 5, 22);
        const v = hash(p.x, p.y, 9);
        const base = v > 0.5 ? '#4E9A45' : '#5AA84B';
        circle(ctx, g[0] - 9, g[1] - 30, 12, shade(base, -0.12));
        circle(ctx, g[0] + 9, g[1] - 31, 12, shade(base, -0.2));
        circle(ctx, g[0], g[1] - 42, 14, base);
        circle(ctx, g[0] - 4, g[1] - 46, 6, shade(base, 0.22));
        break;
      }
      case 'pine': {
        ellipse(ctx, g[0] + 3, g[1] + 2, 12, 5, 'rgba(30,50,20,.2)');
        ctx.fillStyle = '#5E4128'; ctx.fillRect(g[0] - 2, g[1] - 12, 4, 12);
        for (let i = 0; i < 3; i++) poly(ctx, [[g[0], g[1] - 58 + i * 13], [g[0] + 15 - i * 1, g[1] - 22 + i * 7 - 10], [g[0] - 15 + i * 1, g[1] - 22 + i * 7 - 10]], i === 0 ? '#2F6B3F' : shade('#2F6B3F', -0.08 * i));
        break;
      }
      case 'grave': {
        const cross = hash(p.x, p.y, 4) > 0.5;
        if (cross) {
          ctx.fillStyle = '#9EA2A0'; ctx.fillRect(g[0] - 1.8, g[1] - 22, 3.6, 22); ctx.fillRect(g[0] - 7, g[1] - 17, 14, 3.4);
          circle(ctx, g[0], g[1] - 15.5, 4.5, null, '#9EA2A0', 1.6);
        } else rrect(ctx, g[0] - 6, g[1] - 16, 12, 16, 5, '#A8ACAA', '#8B8F8D');
        break;
      }
      case 'bench': {
        box(ctx, p.x + 0.2, p.y + 0.4, p.x + 0.8, p.y + 0.6, 6, 3, '#9C6B3F', '#8A5E36', '#77502E');
        box(ctx, p.x + 0.2, p.y + 0.4, p.x + 0.8, p.y + 0.46, 9, 8, '#9C6B3F', '#8A5E36', '#77502E');
        ctx.fillStyle = '#3B3B3B';
        [P(p.x + 0.25, p.y + 0.58), P(p.x + 0.75, p.y + 0.58)].forEach((q) => ctx.fillRect(q[0] - 1, q[1] - 6, 2, 6));
        break;
      }
      case 'statue': {
        box(ctx, p.x + 0.25, p.y + 0.25, p.x + 0.75, p.y + 0.75, 0, 14, '#C9C2B4', '#B3AC9E', '#9D9689');
        const t = P(cx, cy, 14);
        ctx.fillStyle = '#5E6E5A';
        rrect(ctx, t[0] - 4, t[1] - 22, 8, 22, 3, '#5E7A63');
        circle(ctx, t[0], t[1] - 26, 4.5, '#5E7A63');
        ctx.fillRect(t[0] + 3, t[1] - 20, 8, 2.5);
        break;
      }
      case 'flowers': {
        box(ctx, p.x + 0.15, p.y + 0.15, p.x + 0.85, p.y + 0.85, 0, 7, '#6E5238', '#8C6A4A', '#77593D');
        for (let i = 0; i < 9; i++) { const q = P(p.x + 0.22 + hash(p.x, i, 1) * 0.56, p.y + 0.22 + hash(p.y, i, 2) * 0.56, 7); circle(ctx, q[0], q[1] - 2, 2.2, ['#E84A5F', '#FFD23F', '#FFFFFF', '#B56BD6'][i % 4]); }
        break;
      }
      case 'lamp': {
        const q = P(p.x + 0.5, p.y + 0.5);
        ctx.fillStyle = '#2F3A3A'; ctx.fillRect(q[0] - 1.2, q[1] - 46, 2.4, 46);
        rrect(ctx, q[0] - 4, q[1] - 52, 8, 7, 2, env.evening > 0.45 ? '#FFE9A8' : '#DDE3E0', '#2F3A3A');
        break;
      }
      case 'postbox': {
        const q = P(p.x + 0.3, p.y + 0.3);
        ellipse(ctx, q[0], q[1] + 1, 6, 3, 'rgba(0,0,0,.2)');
        rrect(ctx, q[0] - 5, q[1] - 20, 10, 20, 4, '#1F7A45', '#15593A');
        ctx.fillStyle = '#0E3B26'; ctx.fillRect(q[0] - 3, q[1] - 14, 6, 1.6);
        break;
      }
      case 'busstop': {
        box(ctx, p.x + 0.15, p.y + 0.25, p.x + 0.85, p.y + 0.55, 0, 34, null, 'rgba(190,225,240,.45)', 'rgba(170,205,225,.45)');
        box(ctx, p.x + 0.1, p.y + 0.2, p.x + 0.9, p.y + 0.6, 34, 3, '#3C6E8F', '#335F7B', '#2B5169');
        const q = P(p.x + 0.12, p.y + 0.6);
        ctx.fillStyle = '#44525A'; ctx.fillRect(q[0] - 1, q[1] - 44, 2, 44);
        circle(ctx, q[0], q[1] - 46, 6, '#FFFFFF', '#3C6E8F', 2);
        ctx.fillStyle = '#3C6E8F'; ctx.font = '800 6px Figtree, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUS', q[0], q[1] - 44);
        break;
      }
      case 'fence': {
        const alongX = p.axis === 'x';
        const a = alongX ? P(p.x, cy) : P(cx, p.y), b = alongX ? P(p.x + 1, cy) : P(cx, p.y + 1);
        ctx.fillStyle = 'rgba(120,135,140,.25)';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 26); ctx.lineTo(a[0], a[1] - 26); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(80,95,100,.45)'; ctx.lineWidth = 0.8;
        for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - 26); ctx.stroke(); }
        ctx.strokeStyle = '#5E6B70'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 28); ctx.moveTo(a[0], a[1] - 26); ctx.lineTo(b[0], b[1] - 26); ctx.stroke();
        break;
      }
      case 'notice': {
        const q = P(cx, cy);
        ctx.fillStyle = '#4B4F52'; ctx.fillRect(q[0] - 10, q[1] - 30, 2, 30); ctx.fillRect(q[0] + 8, q[1] - 30, 2, 30);
        rrect(ctx, q[0] - 14, q[1] - 44, 28, 20, 2, '#FFFFFF', '#4B4F52');
        ctx.fillStyle = '#00727C'; ctx.fillRect(q[0] - 13, q[1] - 43, 26, 5);
        ctx.fillStyle = 'rgba(36,28,23,.5)'; for (let i = 0; i < 3; i++) ctx.fillRect(q[0] - 11, q[1] - 35 + i * 3.5, 22 - i * 5, 1.4);
        break;
      }
      case 'board': {
        const q = P(cx, cy);
        ctx.fillStyle = '#6B4A2E'; ctx.fillRect(q[0] - 12, q[1] - 28, 2.5, 28); ctx.fillRect(q[0] + 9.5, q[1] - 28, 2.5, 28);
        rrect(ctx, q[0] - 15, q[1] - 44, 30, 20, 2, '#A57A4F', '#6B4A2E');
        [['#FFFFFF', -12, -42], ['#FFE066', -1, -41], ['#CFE3F6', 5, -35], ['#FFFFFF', -9, -34]].forEach((n) => { ctx.fillStyle = n[0]; ctx.fillRect(q[0] + n[1], q[1] + n[2], 8, 7); });
        break;
      }
      case 'tank': {
        const q = P(cx, cy);
        ellipse(ctx, q[0] + 3, q[1] + 2, 20, 9, 'rgba(0,0,0,.15)');
        ctx.fillStyle = '#8C98A2'; [-12, 12].forEach((dx) => ctx.fillRect(q[0] + dx - 1.5, q[1] - 14, 3, 14));
        ctx.fillStyle = '#A9C3D3'; ctx.fillRect(q[0] - 17, q[1] - 56, 34, 42);
        ellipse(ctx, q[0], q[1] - 14, 17, 7, '#8FAABB');
        ctx.fillStyle = '#A9C3D3'; ctx.fillRect(q[0] - 17, q[1] - 56, 34, 42);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(q[0] - 12, q[1] - 54, 5, 38);
        ellipse(ctx, q[0], q[1] - 56, 17, 7, '#C8DBE6');
        ctx.strokeStyle = 'rgba(60,80,95,.3)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(q[0], q[1] - 14 - i * 10.5, 17, 7, 0, 0, Math.PI); ctx.stroke(); }
        break;
      }
      case 'chiller': {
        box(ctx, p.x + 0.1, p.y + 0.1, p.x + 0.9, p.y + 0.9, 0, 18, '#C3CBD2', '#AAB4BD', '#95A0AA');
        const c = P(cx, cy, 18); ellipse(ctx, c[0], c[1], 13, 6.5, '#6E7B86');
        if (!env.reduced) { const a = env.t * 7 + p.y; ctx.strokeStyle = '#C3CBD2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0] + Math.cos(a) * 12, c[1] + Math.sin(a) * 6); ctx.lineTo(c[0] - Math.cos(a) * 12, c[1] - Math.sin(a) * 6); ctx.stroke(); }
        break;
      }
      case 'turbine': {
        const q = P(cx, cy);
        ellipse(ctx, q[0] + 6, q[1] + 2, 14, 5, 'rgba(0,0,0,.15)');
        const top = 168;
        poly(ctx, [[q[0] - 4.5, q[1]], [q[0] + 4.5, q[1]], [q[0] + 2, q[1] - top], [q[0] - 2, q[1] - top]], '#F4F6F7', 'rgba(120,130,140,.5)');
        rrect(ctx, q[0] - 6, q[1] - top - 6, 16, 9, 3, '#E9EDEF', 'rgba(120,130,140,.6)');
        const hub = [q[0] - 5, q[1] - top - 1.5];
        const rot = (env.reduced ? env.t * 0.25 : env.t * 1.6) + p.x;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = rot + i * (Math.PI * 2 / 3);
          const ex = hub[0] + Math.cos(a) * 58 * 0.55, ey = hub[1] + Math.sin(a) * 58;
          ctx.strokeStyle = '#FBFCFD'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.strokeStyle = 'rgba(120,130,140,.45)'; ctx.lineWidth = 1; ctx.stroke();
        }
        circle(ctx, hub[0], hub[1], 3.2, '#DDE3E6', '#8A949B');
        ctx.lineCap = 'butt';
        break;
      }
      case 'roundtower': {
        const q = P(cx, cy);
        ellipse(ctx, q[0] + 5, q[1] + 2, 18, 7, 'rgba(0,0,0,.18)');
        const hgt = 104, r = 13;
        ctx.fillStyle = '#A8A195'; ctx.fillRect(q[0] - r, q[1] - hgt, r * 2, hgt);
        ellipse(ctx, q[0], q[1], r, r / 2, '#A8A195');
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(q[0] + 3, q[1] - hgt, r - 3, hgt);
        for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(80,70,60,.25)'; ctx.fillRect(q[0] - r + hash(i, 1, 1) * 20, q[1] - 10 - i * 10, 5, 2); }
        poly(ctx, [[q[0] - r - 1, q[1] - hgt], [q[0] + r + 1, q[1] - hgt], [q[0], q[1] - hgt - 28]], '#8C8579');
        poly(ctx, [[q[0], q[1] - hgt], [q[0] + r + 1, q[1] - hgt], [q[0], q[1] - hgt - 28]], '#777064');
        rrect(ctx, q[0] - 3, q[1] - 44, 6, 10, 3, '#3A3430');
        ctx.fillStyle = '#3A3430'; ctx.fillRect(q[0] - 1.5, q[1] - 90, 3, 7);
        break;
      }
      case 'rock': {
        const q = P(cx, cy);
        ellipse(ctx, q[0] + 2, q[1] + 1, 11, 4.5, 'rgba(0,0,0,.18)');
        ctx.beginPath(); ctx.ellipse(q[0], q[1] - 5, 11, 8, 0, Math.PI, 0); ctx.lineTo(q[0] + 11, q[1] - 2); ctx.lineTo(q[0] - 11, q[1] - 2); ctx.closePath(); ctx.fillStyle = C.rock; ctx.fill();
        ellipse(ctx, q[0] - 3, q[1] - 9, 4, 2.5, '#B6BBBE');
        break;
      }
      case 'wall': {
        const a = p.axis === 'x';
        const x0 = a ? p.x : p.x + 0.36, x1 = a ? p.x + 1 : p.x + 0.64, y0 = a ? p.y + 0.36 : p.y, y1 = a ? p.y + 0.64 : p.y + 1;
        box(ctx, x0, y0, x1, y1, 0, 12, '#B2ADA3', '#9C978D', '#87827A');
        for (let i = 0; i < 4; i++) { const q = a ? P(p.x + 0.12 + i * 0.25, y1, 3 + (i % 2) * 5) : P(x1, p.y + 0.12 + i * 0.25, 3 + (i % 2) * 5); ellipse(ctx, q[0], q[1], 4, 2, 'rgba(70,65,60,.35)'); }
        break;
      }
      case 'hedge': {
        box(ctx, p.x + 0.1, p.y + 0.1, p.x + 0.9, p.y + 0.9, 0, 14, '#4F8F45', '#44803B', '#3A6F33');
        for (let i = 0; i < 4; i++) { const q = P(p.x + 0.2 + i * 0.2, p.y + 0.9, 13); circle(ctx, q[0], q[1], 4, '#5A9C4F'); }
        break;
      }
      case 'bale': {
        const q = P(cx, cy);
        ellipse(ctx, q[0] + 3, q[1] + 1, 14, 5, 'rgba(0,0,0,.2)');
        ellipse(ctx, q[0], q[1] - 10, 13, 11, '#23282A');
        ellipse(ctx, q[0] + 5, q[1] - 11, 7, 9, '#383F42');
        ellipse(ctx, q[0] - 4, q[1] - 15, 4, 2, 'rgba(255,255,255,.3)');
        break;
      }
      case 'turf': {
        const q = P(cx, cy);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) { const x = q[0] - 9 + i * 7 + r * 3.5, y = q[1] - 5 - r * 5; rrect(ctx, x, y, 6.5, 5, 1, r % 2 ? '#5A3F2A' : '#4A3322'); }
        break;
      }
      case 'goal': {
        const y = p.y === 23 ? 23.25 : 30.75;
        const a = P(13.9, y), b = P(15.1, y);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 62); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 62); ctx.moveTo(a[0], a[1] - 20); ctx.lineTo(b[0], b[1] - 20); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.8;
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * i / 5, a[1] + (b[1] - a[1]) * i / 5 - 20); ctx.lineTo(a[0] + (b[0] - a[0]) * i / 5, a[1] + (b[1] - a[1]) * i / 5 - 2); ctx.stroke(); }
        ctx.lineCap = 'butt';
        break;
      }
      case 'swing': {
        const a = P(p.x + 0.15, cy), b = P(p.x + 0.85, cy);
        ctx.strokeStyle = '#D1495B'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a[0] - 4, a[1]); ctx.lineTo(a[0], a[1] - 34); ctx.lineTo(a[0] + 4, a[1]); ctx.moveTo(b[0] - 4, b[1]); ctx.lineTo(b[0], b[1] - 34); ctx.lineTo(b[0] + 4, b[1]); ctx.moveTo(a[0], a[1] - 34); ctx.lineTo(b[0], b[1] - 34); ctx.stroke();
        const sw = env.reduced ? 0 : Math.sin(env.t * 2) * 3;
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ctx.beginPath(); ctx.moveTo(m[0] - 4, m[1] - 33); ctx.lineTo(m[0] - 4 + sw, m[1] - 10); ctx.moveTo(m[0] + 4, m[1] - 33); ctx.lineTo(m[0] + 4 + sw, m[1] - 10); ctx.stroke();
        ctx.fillStyle = '#3C6E8F'; ctx.fillRect(m[0] - 6 + sw, m[1] - 11, 12, 3);
        break;
      }
      default: break;
    }
  }

  /** Footprint (tile space) and height of a prop, for depth sorting. */
  function propBox(p) {
    const cx = p.x + 0.5, cy = p.y + 0.5;
    switch (p.kind) {
      case 'fence': return p.axis === 'x' ? { x0: p.x, y0: cy - 0.05, x1: p.x + 1, y1: cy + 0.05, h: 30 } : { x0: cx - 0.05, y0: p.y, x1: cx + 0.05, y1: p.y + 1, h: 30 };
      case 'wall': return p.axis === 'x' ? { x0: p.x, y0: p.y + 0.36, x1: p.x + 1, y1: p.y + 0.64, h: 12 } : { x0: p.x + 0.36, y0: p.y, x1: p.x + 0.64, y1: p.y + 1, h: 12 };
      case 'goal': { const y = p.y === 23 ? 23.25 : 30.75; return { x0: 13.9, y0: y - 0.05, x1: 15.1, y1: y + 0.05, h: 64 }; }
      case 'turbine': return { x0: cx - 0.2, y0: cy - 0.2, x1: cx + 0.2, y1: cy + 0.2, h: 240, w: 70 };
      case 'roundtower': return { x0: cx - 0.3, y0: cy - 0.3, x1: cx + 0.3, y1: cy + 0.3, h: 140 };
      case 'tree': return { x0: cx - 0.3, y0: cy - 0.3, x1: cx + 0.3, y1: cy + 0.3, h: 60, w: 22 };
      case 'pine': return { x0: cx - 0.25, y0: cy - 0.25, x1: cx + 0.25, y1: cy + 0.25, h: 62 };
      case 'lamp': return { x0: cx - 0.08, y0: cy - 0.08, x1: cx + 0.08, y1: cy + 0.08, h: 56 };
      case 'postbox': return { x0: p.x + 0.2, y0: p.y + 0.2, x1: p.x + 0.4, y1: p.y + 0.4, h: 24 };
      case 'tank': return { x0: p.x + 0.1, y0: p.y + 0.1, x1: p.x + 0.9, y1: p.y + 0.9, h: 70 };
      case 'busstop': return { x0: p.x + 0.1, y0: p.y + 0.2, x1: p.x + 0.9, y1: p.y + 0.6, h: 52 };
      default: return { x0: p.x + 0.1, y0: p.y + 0.1, x1: p.x + 0.9, y1: p.y + 0.9, h: 48 };
    }
  }

  /* ============================================================ PEOPLE */
  /**
   * Draw a person with their feet at (sx, sy).
   * look: { skin, hair, hairStyle, top, bottom, hat, reporter }
   * pose: { dir: 'se'|'sw'|'ne'|'nw', phase, moving, scale, alpha, reduced }
   */
  function drawPerson(ctx, sx, sy, look, pose) {
    const s = pose.scale || 1;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(s, s);
    if (pose.alpha != null) ctx.globalAlpha *= pose.alpha;
    ellipse(ctx, 0, 0, 9, 4.2, 'rgba(20,30,20,.25)');
    const moving = pose.moving && !pose.reduced;
    const sw = moving ? Math.sin(pose.phase) : 0;
    const bob = moving ? Math.abs(Math.sin(pose.phase)) * 1.6 : 0;
    const front = pose.dir === 'se' || pose.dir === 'sw';
    const flip = pose.dir === 'sw' || pose.dir === 'nw' ? -1 : 1;
    ctx.translate(0, -bob);
    // legs + shoes
    const legCol = look.bottom;
    const l1 = Math.max(0, sw) * 2.6, l2 = Math.max(0, -sw) * 2.6;
    ctx.fillStyle = legCol;
    ctx.fillRect(-5, -12, 4, 12 - l1);
    ctx.fillRect(1, -12, 4, 12 - l2);
    ctx.fillStyle = '#2A2522';
    ctx.fillRect(-5.5, -2.2 - l1, 5, 2.4);
    ctx.fillRect(0.5, -2.2 - l2, 5, 2.4);
    // back arm
    const armSw = sw * 2.2;
    rrect(ctx, flip * 6.2 - 2, -24 - armSw * 0.4, 4, 12, 2, shade(look.top, -0.25));
    // body
    rrect(ctx, -7.5, -27, 15, 17, 5, look.top);
    rrect(ctx, flip > 0 ? 1.5 : -7.5, -27, 6, 17, 4, shade(look.top, -0.14));
    if (look.reporter) {
      // raincoat hood rim + zip, lanyard
      ctx.strokeStyle = C.coatDark; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -11); ctx.stroke();
      rrect(ctx, flip * 2 - 3, -21, 6, 7, 1.5, '#FFFFFF', '#3A3A3A', 0.8);
      ctx.fillStyle = C.data; ctx.fillRect(flip * 2 - 2.2, -20.2, 4.4, 2);
    }
    // front arm (holds the mic for the reporter)
    if (look.reporter) {
      const hx = -flip * 9, hy = -20;
      rrect(ctx, -flip * 6.2 - 2, -25, 4, 9, 2, shade(look.top, -0.08));
      ctx.fillStyle = '#2A2A2A'; ctx.fillRect(hx - 1.3, hy - 8, 2.6, 9);
      circle(ctx, hx, hy - 10, 4.2, C.opinion);
      circle(ctx, hx - 1.3, hy - 11.4, 1.3, 'rgba(255,255,255,.5)');
    } else {
      rrect(ctx, -flip * 6.2 - 2, -24 + armSw * 0.4, 4, 12, 2, shade(look.top, -0.08));
    }
    // head
    const hy = -33;
    circle(ctx, 0, hy, 6.6, look.skin);
    // hair
    const hairCol = look.hair;
    if (look.hat === 'cap') {
      ctx.beginPath(); ctx.arc(0, hy - 1, 6.9, Math.PI, 0); ctx.fillStyle = look.hatCol || '#3C6E8F'; ctx.fill();
      if (front) ellipse(ctx, flip * 4, hy - 1.2, 5, 1.8, shade(look.hatCol || '#3C6E8F', -0.2));
    } else if (look.hat === 'beanie') {
      ctx.beginPath(); ctx.arc(0, hy - 1.5, 7, Math.PI, 0); ctx.fillStyle = look.hatCol || '#D1495B'; ctx.fill();
      circle(ctx, 0, hy - 8.8, 2.3, shade(look.hatCol || '#D1495B', 0.3));
    } else if (look.reporter) {
      // headphones
      ctx.beginPath(); ctx.arc(0, hy - 1, 7.4, Math.PI * 1.05, Math.PI * 1.95); ctx.strokeStyle = '#2F2F2F'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, hy - 1.5, 6.6, Math.PI, 0); ctx.fillStyle = hairCol; ctx.fill();
      rrect(ctx, -8.6, hy - 2, 3.4, 5.5, 1.5, '#2F2F2F'); rrect(ctx, 5.2, hy - 2, 3.4, 5.5, 1.5, '#2F2F2F');
    } else if (look.hairStyle !== 'bald') {
      ctx.beginPath(); ctx.arc(0, hy - 1, 6.9, Math.PI * (front ? 1 : 0.85), Math.PI * (front ? 2 : 2.15)); ctx.fillStyle = hairCol; ctx.fill();
      if (!front) circle(ctx, 0, hy + 0.5, 6.4, hairCol);
      if (look.hairStyle === 'long') { rrect(ctx, -7.3, hy - 2, 3.4, 11, 1.7, hairCol); rrect(ctx, 3.9, hy - 2, 3.4, 11, 1.7, hairCol); }
      if (look.hairStyle === 'bun') circle(ctx, -flip * 2, hy - 8, 3.2, hairCol);
      if (look.hairStyle === 'curly') { for (let i = 0; i < 5; i++) circle(ctx, -6 + i * 3, hy - 5 - (i % 2), 2.6, hairCol); }
    }
    if (front) {
      circle(ctx, flip * 1.2 - 2.3, hy + 0.6, 0.95, '#241C17');
      circle(ctx, flip * 1.2 + 2.3, hy + 0.6, 0.95, '#241C17');
      if (look.hairStyle === 'beard') { ctx.beginPath(); ctx.arc(flip * 0.5, hy + 2, 5.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fillStyle = hairCol; ctx.fill(); }
    }
    ctx.restore();
  }

  /** A sheep, facing left or right. */
  function drawSheep(ctx, sx, sy, sh, env) {
    ctx.save();
    ctx.translate(sx, sy);
    const bob = sh.moving && !env.reduced ? Math.abs(Math.sin(sh.phase)) * 1.2 : 0;
    ellipse(ctx, 0, 0, 11, 4.5, 'rgba(20,30,20,.22)');
    ctx.fillStyle = '#2A2522';
    [-6, -2, 3, 7].forEach((dx, i) => ctx.fillRect(dx - 1, -6, 2, 6 - (sh.moving && i % 2 === (Math.sin(sh.phase) > 0 ? 0 : 1) ? 1.5 : 0)));
    ctx.translate(0, -bob);
    [[-6, -10], [-1, -12], [4, -11], [7, -8], [-3, -7], [2, -7]].forEach((c) => circle(ctx, c[0], c[1], 5.2, '#F5F3EE'));
    circle(ctx, -2, -12, 4, '#FFFFFF');
    const f = sh.face || 1;
    ellipse(ctx, f * 11, -11, 3.6, 4.6, '#2A2522');
    ellipse(ctx, f * 9, -14, 2.2, 1.2, '#2A2522');
    ctx.restore();
  }

  /* ============================================================ MARKERS */
  function keycap(ctx, x, y, label, t, reduced) {
    const b = reduced ? 0 : Math.sin(t * 5) * 2;
    ctx.save();
    ctx.translate(x, y + b);
    rrect(ctx, -9, -9 + 2, 18, 18, 4, 'rgba(0,0,0,.25)');
    rrect(ctx, -9, -9, 18, 18, 4, '#FFFFFF', C.ink, 1.5);
    ctx.fillStyle = C.ink; ctx.font = '800 11px Figtree, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0.5);
    ctx.restore();
  }
  /** Answer badge: yes = filled dot, other = ring, declined = dashed ring. Same code as the crowd. */
  function badge(ctx, x, y, kind, scale) {
    const r = 5.5 * (scale || 1);
    ctx.save();
    if (kind === 'yes') { circle(ctx, x, y, r + 1.5, '#FFFFFF'); circle(ctx, x, y, r, C.opinion); }
    else if (kind === 'no') { circle(ctx, x, y, r + 1.5, '#FFFFFF'); circle(ctx, x, y, r - 0.7, null, '#5B524B', 2); }
    else { ctx.setLineDash([2, 2]); circle(ctx, x, y, r, 'rgba(255,255,255,.7)', '#7A716A', 1.5); }
    ctx.restore();
  }
  function evidenceMarker(ctx, x, y, t, collected, near, reduced) {
    const b = reduced ? 0 : Math.sin(t * 2.4 + x * 0.01) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(0,114,124,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46 + b); ctx.stroke(); ctx.setLineDash([]);
    ellipse(ctx, 0, 0, near ? 14 : 9, near ? 7 : 4.5, near ? 'rgba(0,114,124,.35)' : 'rgba(0,114,124,.2)');
    ctx.translate(0, -58 + b);
    const r = near ? 12 : 10;
    poly(ctx, [[0, -r], [r, 0], [0, r], [-r, 0]], collected ? '#FFFFFF' : C.data, C.data, 2);
    if (collected) {
      ctx.strokeStyle = C.data; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 3); ctx.lineTo(4.5, -3.5); ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-5, 0, 2.6, 4); ctx.fillRect(-1.3, -3, 2.6, 7); ctx.fillRect(2.4, -5.5, 2.6, 9.5);
    }
    ctx.restore();
  }
  function nameTag(ctx, x, y, text, sub) {
    ctx.save();
    ctx.font = '700 11px Figtree, system-ui, sans-serif';
    const w = Math.max(ctx.measureText(text).width, sub ? (ctx.font = '500 9px Figtree, system-ui, sans-serif', ctx.measureText(sub).width) : 0) + 14;
    const h = sub ? 30 : 18;
    rrect(ctx, x - w / 2, y - h, w, h, 6, 'rgba(255,255,255,.95)', 'rgba(36,28,23,.25)');
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 11px Figtree, system-ui, sans-serif'; ctx.fillText(text, x, y - h + 10);
    if (sub) { ctx.font = '500 9px Figtree, system-ui, sans-serif'; ctx.fillStyle = '#5B524B'; ctx.fillText(sub, x, y - 9); }
    ctx.restore();
  }
  /** A figure in the "meet the 200" crowd. cat: 'yes' | 'no' | 'none' */
  function crowdFig(ctx, x, y, cat, k) {
    const s = k == null ? 1 : k;
    if (s <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ellipse(ctx, 0, 0, 6, 3, 'rgba(20,30,20,.25)');
    if (cat === 'yes') { rrect(ctx, -5, -16, 10, 14, 4, C.opinion); circle(ctx, 0, -20.5, 4.6, shade(C.opinion, 0.25)); }
    else if (cat === 'no') { rrect(ctx, -5, -16, 10, 14, 4, '#FFFFFF', '#5B524B', 1.6); circle(ctx, 0, -20.5, 4.4, '#FFFFFF', '#5B524B', 1.6); }
    else { ctx.setLineDash([2, 2]); rrect(ctx, -5, -16, 10, 14, 4, 'rgba(255,255,255,.35)', '#6F665F', 1.3); circle(ctx, 0, -20.5, 4.4, 'rgba(255,255,255,.35)', '#6F665F', 1.3); }
    ctx.restore();
  }
  function dust(ctx, x, y, k) {
    circle(ctx, x, y, 2 + k * 4, 'rgba(255,255,255,' + (0.55 * (1 - k)) + ')');
  }

  VP.Art = Object.assign(ART, {
    renderGround, drawBuilding, drawProp, propBox, drawPerson, drawSheep, keycap, badge, evidenceMarker, nameTag, crowdFig, dust,
  });
})();
