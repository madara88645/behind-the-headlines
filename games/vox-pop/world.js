/*
 * Vox Pop - world.js
 * The made-up town of Ballinacloud: a 32 x 32 isometric tile map, its buildings and props,
 * districts (which survey q4 group a resident belongs to), evidence points, collision and pathfinding.
 * No survey numbers or facts live here - only geography.
 */
(function () {
  'use strict';
  const VP = (window.VP = window.VP || {});

  const W = 32, H = 32;          // map size in tiles
  const TW = 64, TH = 32;        // tile size in pixels (2:1 isometric)

  /* ------------------------------------------------------------ ground */
  // Ground types: grass, heather, road, pave, water, bridge, field, crop, bog, concrete, pitch, dirt
  const ground = [];
  for (let y = 0; y < H; y++) { ground.push(new Array(W).fill('grass')); }
  function paint(type, x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) ground[y][x] = type;
    }
  }
  // west strip: hill (north) and farms (south)
  paint('heather', 0, 0, 8, 10);
  paint('field', 0, 17, 8, 24);
  paint('crop', 5, 27, 8, 31);
  paint('bog', 0, 28, 3, 31);
  // river
  paint('water', 9, 0, 10, 31);
  // campus yard
  paint('concrete', 24, 0, 31, 11);
  // town square and footpaths
  paint('pave', 12, 8, 15, 11);
  paint('pave', 11, 14, 31, 14);
  paint('pave', 11, 16, 31, 16);
  paint('pave', 15, 12, 15, 13);
  paint('pave', 15, 17, 15, 18);
  // GAA pitch
  paint('pitch', 11, 23, 18, 30);
  // trails
  paint('dirt', 5, 3, 5, 14);
  paint('dirt', 0, 26, 8, 26);
  paint('dirt', 11, 5, 15, 5);
  paint('dirt', 20, 30, 25, 31);
  // roads (last, so they win)
  paint('road', 0, 15, 31, 15);          // Main Street
  paint('road', 16, 0, 16, 14);          // Church Road
  paint('road', 16, 16, 16, 21);         // Pitch Road
  paint('road', 16, 21, 31, 21);         // Oakfield Road
  paint('road', 27, 22, 27, 31);         // Oakfield Close
  paint('road', 27, 12, 27, 14);         // campus access
  paint('bridge', 9, 15, 10, 15);
  paint('bridge', 9, 26, 10, 26);
  paint('bridge', 9, 5, 10, 5);

  /* ------------------------------------------------------------ districts */
  // urban / suburban / rural map to the survey's q4 answers. campus and river have no residents.
  function districtAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    if (x <= 8) return 'rural';
    if (x <= 10) return 'river';
    if (x >= 23 && y <= 12) return 'campus';
    if (y >= 19) return 'suburban';
    return 'urban';
  }

  /* ------------------------------------------------------------ objects */
  // Buildings: footprint [x0,x1) x [y0,y1) in tiles, wall height h (px), style and colours.
  const buildings = [];
  function bld(o) { buildings.push(o); return o; }

  // Main Street, north side - painted shopfronts facing the street
  bld({ id: 'post', x0: 11, y0: 12, x1: 13, y1: 14, h: 58, style: 'shop', wall: '#2F7D5B', roof: 'flat', sign: 'Post Office' });
  bld({ id: 'cafe', x0: 13, y0: 12, x1: 15, y1: 14, h: 52, style: 'shop', wall: '#E7B53C', roof: 'flat', sign: 'Café' });
  bld({ id: 'pub', x0: 17, y0: 12, x1: 19, y1: 14, h: 60, style: 'shop', wall: '#27405E', roof: 'flat', sign: 'The Bridge Inn' });
  bld({ id: 'credit', x0: 19, y0: 12, x1: 21, y1: 14, h: 54, style: 'shop', wall: '#C8563F', roof: 'flat', sign: 'Credit Union' });
  bld({ id: 'shop', x0: 21, y0: 12, x1: 23, y1: 14, h: 50, style: 'shop', wall: '#E596A5', roof: 'flat', sign: 'Shop' });
  // Main Street, south side
  bld({ id: 'library', x0: 11, y0: 17, x1: 13, y1: 19, h: 56, style: 'shop', wall: '#9B83C9', roof: 'flat', sign: 'Library' });
  bld({ id: 'pharmacy', x0: 13, y0: 17, x1: 15, y1: 19, h: 50, style: 'shop', wall: '#7FC4A4', roof: 'flat', sign: 'Pharmacy' });
  bld({ id: 'chipper', x0: 17, y0: 17, x1: 19, y1: 19, h: 50, style: 'shop', wall: '#5E9FD6', roof: 'flat', sign: 'Chipper' });
  bld({ id: 'hardware', x0: 19, y0: 17, x1: 21, y1: 19, h: 54, style: 'shop', wall: '#E98B3A', roof: 'flat', sign: 'Hardware' });
  bld({ id: 'terrace1', x0: 28, y0: 17, x1: 30, y1: 19, h: 48, style: 'house', wall: '#F1E3C4', roof: 'gable-x', roofCol: '#4A4F57' });
  bld({ id: 'terrace2', x0: 30, y0: 17, x1: 32, y1: 19, h: 48, style: 'house', wall: '#B7D3E8', roof: 'gable-x', roofCol: '#4A4F57' });
  // church
  bld({ id: 'church', x0: 18, y0: 3, x1: 21, y1: 7, h: 58, style: 'church', wall: '#C9C2B4', roof: 'gable-y', roofCol: '#5B5F66' });
  bld({ id: 'tower', x0: 21, y0: 4, x1: 22, y1: 5, h: 96, style: 'spire', wall: '#BDB5A6', roof: 'spire', roofCol: '#4C5057' });
  // data-centre campus
  bld({ id: 'hallA', x0: 26, y0: 1, x1: 31, y1: 5, h: 74, style: 'dc', wall: '#DCE2E8', roof: 'dc' });
  bld({ id: 'hallB', x0: 26, y0: 6, x1: 31, y1: 10, h: 74, style: 'dc', wall: '#DCE2E8', roof: 'dc', door: 0.42 });
  bld({ id: 'substation', x0: 24, y0: 1, x1: 26, y1: 3, h: 16, style: 'substation', wall: '#A7AFB6', roof: 'flat' });
  bld({ id: 'energy', x0: 24, y0: 17, x1: 26, y1: 19, h: 44, style: 'energy', wall: '#8FB9A8', roof: 'flat' });
  // Oakfield estate - semi-detached houses
  const houseCols = ['#F3D9B1', '#CFE3D4', '#E9C9D0', '#D6DEEF', '#F2E6A6', '#E3D5C5', '#C9D9E6', '#F0CFB8'];
  [[28, 19], [30, 19], [23, 23], [28, 23], [30, 23], [20, 27], [23, 27], [28, 27], [30, 27]].forEach((p, i) => {
    bld({ id: 'house' + i, x0: p[0], y0: p[1], x1: p[0] + 2, y1: p[1] + 2, h: 46, style: 'house', wall: houseCols[i % houseCols.length], roof: i % 2 ? 'gable-y' : 'gable-x', roofCol: i % 3 ? '#6B4F45' : '#4A4F57' });
  });
  bld({ id: 'hall', x0: 20, y0: 23, x1: 23, y1: 25, h: 42, style: 'hall', wall: '#E7E1D6', roof: 'gable-x', roofCol: '#3F6B5A', sign: 'Community hall' });
  // farms
  bld({ id: 'farmA', x0: 2, y0: 12, x1: 5, y1: 14, h: 44, style: 'farmhouse', wall: '#F4F1EA', roof: 'gable-x', roofCol: '#3E444C' });
  bld({ id: 'barn', x0: 6, y0: 11, x1: 8, y1: 13, h: 40, style: 'barn', wall: '#B0413E', roof: 'gable-y', roofCol: '#5D6A63' });
  bld({ id: 'farmB', x0: 1, y0: 22, x1: 4, y1: 24, h: 42, style: 'farmhouse', wall: '#F4F1EA', roof: 'gable-x', roofCol: '#3E444C' });

  // Props: single-tile things. block = stops walking. (Thin things like lamps don't block.)
  const props = [];
  function prop(kind, x, y, o) { props.push(Object.assign({ kind, x, y, block: true }, o || {})); }

  // park trees (north town) and the hill
  [[11, 0], [13, 1], [11, 3], [14, 3], [12, 6], [14, 7], [11, 7], [15, 1], [13, 4]].forEach((p) => prop('tree', p[0], p[1]));
  [[17, 1], [22, 2], [22, 7], [17, 8]].forEach((p) => prop('pine', p[0], p[1]));
  [[18, 0], [19, 0], [20, 0], [18, 1], [20, 1], [21, 1]].forEach((p) => prop('grave', p[0], p[1]));
  prop('bench', 12, 4);
  prop('bench', 14, 9);
  prop('statue', 13, 9);
  prop('flowers', 12, 11);
  prop('flowers', 14, 11);
  prop('bench', 12, 10);
  // Main Street furniture
  [[12, 14], [18, 14], [24, 14], [30, 14], [14, 16], [20, 16], [26, 16]].forEach((p) => prop('lamp', p[0], p[1], { block: false }));
  prop('postbox', 11, 14, { block: false });
  prop('busstop', 15, 17);
  prop('tree', 23, 13); prop('tree', 30, 13);
  prop('tree', 21, 16 + 0); // corner tree on the footpath
  // campus fence (west side and street side), gate at x = 27
  for (let y = 0; y <= 12; y++) prop('fence', 23, y, { axis: 'y' });
  for (let x = 24; x <= 31; x++) if (x !== 27) prop('fence', x, 12, { axis: 'x' });
  prop('notice', 28, 13);
  prop('tank', 24, 7);
  prop('chiller', 31, 2); prop('chiller', 31, 7);
  // hill: turbines, round tower, rocks
  prop('turbine', 2, 2); prop('turbine', 7, 1); prop('turbine', 2, 7);
  prop('roundtower', 7, 7);
  [[4, 1], [0, 5], [6, 9], [3, 10], [8, 4]].forEach((p) => prop('rock', p[0], p[1]));
  // farms: stone walls with gaps, bales, turf, sheep fields
  for (let x = 0; x <= 8; x++) if (x !== 3 && x !== 5) prop('wall', x, 17, { axis: 'x' });
  for (let x = 0; x <= 8; x++) if (x !== 6) prop('wall', x, 21, { axis: 'x' });
  for (let y = 18; y <= 20; y++) if (y !== 19) prop('wall', 4, y, { axis: 'y' });
  prop('bale', 7, 18); prop('bale', 8, 18); prop('bale', 8, 19);
  prop('turf', 1, 29); prop('turf', 3, 30); prop('turf', 0, 31);
  prop('tree', 0, 14); prop('tree', 7, 25); prop('tree', 1, 26 - 1);
  prop('tree', 8, 29);
  // estate: pitch posts, hedges, playground
  prop('goal', 14, 23, { block: false }); prop('goal', 14, 30, { block: false });
  prop('board', 19, 22);
  prop('swing', 22, 30);
  prop('tree', 19, 27); prop('tree', 26, 24); prop('tree', 31, 31); prop('tree', 20, 20); prop('tree', 22, 20);
  [[25, 23], [25, 24], [25, 27], [25, 28]].forEach((p) => prop('hedge', p[0], p[1]));
  prop('tree', 12, 20); prop('tree', 14, 21); prop('tree', 18, 20);

  /* ------------------------------------------------------------ heat pipe (decoration) */
  // Green district-heating pipe from the data hall to the energy centre and on into the estate.
  // Drawn on the ground layer; it dips underground (manhole covers) where it crosses paths and roads.
  const heatPipe = {
    runs: [
      [[25.5, 10.05], [25.5, 11.9]],
      [[25.3, 19.02], [25.3, 20.7]],
      [[25.3, 22.2], [24.5, 22.2], [24.5, 22.98]],
    ],
    manholes: [[25.5, 13.5], [25.5, 15.5], [25.4, 16.5], [25.3, 21.5]],
  };

  /* ------------------------------------------------------------ evidence points */
  // Each point holds fact ids from DC_FACTS. x,y = where the player stands to read it.
  const evidence = [
    { id: 'hall', x: 28.5, y: 10.6, name: 'Data hall', place: 'the data hall on the campus', facts: ['ie-share-2025'], chart: 'cso', icon: 'server' },
    { id: 'substation', x: 24.6, y: 3.7, name: 'Substation', place: 'the substation on the campus', facts: ['ie-share-2034'], icon: 'bolt' },
    { id: 'gate', x: 28.5, y: 14.2, name: 'Planning notice', place: 'the notice at the campus gate', facts: ['ie-cru-2025'], icon: 'notice' },
    { id: 'tank', x: 24.5, y: 8.6, name: 'Water tank', place: 'the water tank on the campus', facts: ['ie-water'], icon: 'drop' },
    { id: 'energy', x: 25.0, y: 19.9, name: 'Energy centre', place: 'the energy centre by the estate', facts: ['ie-tallaght'], icon: 'heat' },
    { id: 'wind', x: 5.5, y: 3.6, name: 'Wind farm', place: 'the wind farm on the hill', facts: ['ie-wind-dd', 'ie-rese'], icon: 'wind' },
    { id: 'library', x: 12.0, y: 16.4, name: 'Library', place: 'the library on Main Street', facts: ['prompt-gemini', 'streaming', 'global-2030'], icon: 'book' },
    { id: 'credit', x: 20.0, y: 14.5, name: 'Credit union', place: 'the credit union on Main Street', facts: ['ie-gva', 'ie-jobs'], icon: 'coin' },
    { id: 'board', x: 19.5, y: 23.3, name: 'Community noticeboard', place: 'the noticeboard in Oakfield estate', facts: ['ie-bills'], icon: 'notice' },
  ];

  /* ------------------------------------------------------------ places residents like to stop at */
  const pois = {
    urban: [[14.5, 16.5], [12.6, 9.5], [15.5, 14.5], [18.5, 14.5], [13.5, 5.5], [16.5, 8.5], [22.5, 16.5], [11.6, 16.5]],
    suburban: [[14.5, 26.5], [21.5, 29.5], [19.5, 21.5], [26.5, 25.5], [22.5, 21.5], [16.5, 29.5], [29.5, 26.2]],
    rural: [[5.5, 14.5], [3.5, 16.2], [6.5, 20.5], [2.5, 25.5], [5.5, 5.5], [1.5, 19.5], [7.5, 23.5]],
  };

  /* ------------------------------------------------------------ collision grid */
  const block = [];
  for (let y = 0; y < H; y++) block.push(new Uint8Array(W));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground[y][x] === 'water') block[y][x] = 1;
  buildings.forEach((b) => {
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (x < W && y < H) block[y][x] = 1;
  });
  props.forEach((p) => { if (p.block) block[p.y][p.x] = 1; });

  function walkable(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x >= 0 && y >= 0 && x < W && y < H && !block[y][x];
  }

  /** Can a circle of radius r stand at (x, y)? */
  function free(x, y, r) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    if (x - r < 0 || y - r < 0 || x + r > W || y + r > H) return false;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!block[ty] || block[ty][tx]) {
        // circle vs tile box
        const cx = Math.max(tx, Math.min(x, tx + 1)), cy = Math.max(ty, Math.min(y, ty + 1));
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------ A* pathfinding */
  function findPath(sx, sy, tx, ty, allowed) {
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    const ok = (x, y) => walkable(x, y) && (!allowed || allowed(x, y));
    if (!ok(tx, ty)) { const n = nearestWalkable(tx + 0.5, ty + 0.5, allowed); if (!n) return null; tx = n[0]; ty = n[1]; }
    if (sx === tx && sy === ty) return [[tx + 0.5, ty + 0.5]];
    const idx = (x, y) => y * W + x;
    const g = new Float32Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const open = [];
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    g[idx(sx, sy)] = 0;
    open.push({ x: sx, y: sy, f: h(sx, sy) });
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ci = idx(cur.x, cur.y);
      if (closed[ci]) continue;
      closed[ci] = 1;
      if (cur.x === tx && cur.y === ty) break;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cur.x + dx, cur.y) || !ok(cur.x, cur.y + dy))) continue; // no corner cutting
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const ng = g[ci] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; from[ni] = ci; open.push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
      }
    }
    const ti = idx(tx, ty);
    if (from[ti] === -1) return null;
    const path = [];
    for (let i = ti; i !== -1 && i !== idx(sx, sy); i = from[i]) path.push([(i % W) + 0.5, Math.floor(i / W) + 0.5]);
    path.reverse();
    return smooth([sx + 0.5, sy + 0.5], path);
  }

  // Drop waypoints we can walk past in a straight line (keeps walking natural).
  function lineClear(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(d / 0.25);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.3)) return false;
    }
    return true;
  }
  function smooth(start, path) {
    if (path.length < 3) return path;
    const out = [];
    let anchor = start, i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !lineClear(anchor, path[j])) j--;
      out.push(path[j]);
      anchor = path[j];
      i = j + 1;
    }
    return out;
  }

  function nearestWalkable(x, y, allowed) {
    const fx = Math.floor(x), fy = Math.floor(y);
    for (let r = 0; r < 12; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = fx + dx, ny = fy + dy;
        if (!walkable(nx, ny) || (allowed && !allowed(nx, ny))) continue;
        const d = Math.hypot(nx + 0.5 - x, ny + 0.5 - y);
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (best) return best;
    }
    return null;
  }

  /** All walkable tiles of a district (cached). */
  const tilesCache = {};
  function districtTiles(d) {
    if (tilesCache[d]) return tilesCache[d];
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!block[y][x] && districtAt(x, y) === d) out.push([x, y]);
    tilesCache[d] = out;
    return out;
  }

  /* ------------------------------------------------------------ projection */
  const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
  /** Screen (world-pixel) point back to tile coordinates on the ground plane. */
  const unIso = (sx, sy) => ({ x: sy / TH + sx / TW, y: sy / TH - sx / TW });

  VP.World = {
    W, H, TW, TH, ground, buildings, props, evidence, pois, heatPipe,
    districtAt, walkable, free, findPath, nearestWalkable, districtTiles, iso, unIso,
    spawn: { x: 14.5, y: 16.45 },
  };
})();
