/*
 * Vox Pop - people.js
 * Made-up residents (and sheep): how they look, where they live, how they wander.
 * A resident's district decides which survey q4 group their answers are drawn from (see sim.js).
 * Names, looks and "what they're up to" are decoration only - they never affect an answer.
 */
(function () {
  'use strict';
  const VP = (window.VP = window.VP || {});
  const Wd = VP.World, Sim = VP.Sim;

  const NAMES = ['Aoife', 'Ciarán', 'Niamh', 'Seán', 'Siobhán', 'Oisín', 'Róisín', 'Cian', 'Saoirse', 'Pádraig', 'Gráinne', 'Eoin',
    'Clodagh', 'Darragh', 'Méabh', 'Tadhg', 'Orla', 'Fionn', 'Nuala', 'Declan', 'Bríd', 'Conor', 'Sinéad', 'Liam', 'Mary', 'Tom',
    'Olena', 'Tomasz', 'Priya', 'Chidi', 'Ana', 'Mohammed', 'Wei', 'Kasia', 'Emeka', 'Lucía', 'Aidan', 'Fiadh', 'Rory', 'Eimear'];
  const SKIN = ['#F6D5BD', '#EBC0A0', '#D9A27E', '#B87C58', '#8C5A3C', '#6A4330'];
  const HAIR = ['#2B1D14', '#4E3322', '#7A4A2A', '#B5652F', '#D9B26A', '#E9DDB8', '#9A9A9A', '#1A1A1A'];
  const TOPS = ['#3F7CAC', '#D1495B', '#EDAE49', '#00798C', '#30638E', '#8E6C8A', '#6A994E', '#BC4749', '#577590', '#E07A5F', '#81B29A', '#3D405B'];
  const BOTTOMS = ['#2E3440', '#4C566A', '#3B5B7A', '#5E503F', '#1F2A36', '#6B705C'];
  const STYLES = ['short', 'short', 'long', 'bun', 'curly', 'bald', 'beard', 'long'];
  const DOING = {
    urban: ['on the way to the shop', 'waiting for the bus', 'out for a coffee', 'posting a letter', 'heading to the library', 'on a lunch break'],
    suburban: ['walking the dog', 'back from the pitch', 'out for a stroll', 'on the way home', 'at the playground with the kids', 'off to the community hall'],
    rural: ['checking on the sheep', 'out for a walk', 'fixing a gap in the wall', 'heading into town', 'bringing in the turf', 'walking the lane'],
  };
  const GREET = ['Go on so, quick one.', 'Is this for the radio? Grand.', 'Fire away.', "I've two minutes.", 'Oh, a vox pop! Go on.', 'Sure, ask away.', 'On the record? Fine.', 'Make it quick, the rain\'s coming.'];
  const BYE = ['Best of luck with the story.', 'Mind yourself.', 'Will I be on the radio?', 'Cheers now.', 'Grand so.', 'Good luck with it.'];
  const DECLINE = ["I'd rather not say, sorry.", "I'll pass on that one, if it's all the same.", "Ah no, I'd rather keep that to myself."];
  // Voiced version only: which of the three female (f1-f3) or three male (m1-m3) voices reads a resident's lines.
  const FEMALE = new Set(['Aoife', 'Niamh', 'Siobhán', 'Róisín', 'Saoirse', 'Gráinne', 'Clodagh', 'Méabh', 'Orla', 'Nuala', 'Bríd', 'Sinéad',
    'Mary', 'Olena', 'Priya', 'Ana', 'Kasia', 'Lucía', 'Fiadh', 'Eimear']);
  const voiceOf = (name, id) => (FEMALE.has(name) ? 'f' : 'm') + (1 + (id % 3));

  function pick(a, r) { return a[Math.floor(r() * a.length) % a.length]; }

  function makeLook(r) {
    const style = pick(STYLES, r);
    const hat = r() < 0.18 ? (r() < 0.5 ? 'cap' : 'beanie') : null;
    return { skin: pick(SKIN, r), hair: pick(HAIR, r), hairStyle: style, top: pick(TOPS, r), bottom: pick(BOTTOMS, r), hat, hatCol: pick(['#3C6E8F', '#D1495B', '#2F6B3F', '#E9C46A', '#3D405B'], r) };
  }

  /** Create the residents for a new game. */
  function makeResidents(r, total) {
    const per = Sim.residentsPerDistrict(total);
    const names = NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = names[i]; names[i] = names[j]; names[j] = t; }
    const out = [];
    let id = 0;
    Sim.DISTRICTS.forEach((d) => {
      const tiles = Wd.districtTiles(d.key);
      for (let i = 0; i < per[d.key]; i++) {
        const t = tiles[Math.floor(r() * tiles.length)];
        out.push({
          id: id, name: names[id % names.length], voice: voiceOf(names[id % names.length], id), district: d.key,
          x: t[0] + 0.5, y: t[1] + 0.5, dir: pick(['se', 'sw', 'ne', 'nw'], r), phase: r() * 6, moving: false,
          speed: 1.1 + r() * 0.8, path: null, wait: r() * 3, look: makeLook(r),
          doing: pick(DOING[d.key], r), greet: pick(GREET, r), bye: pick(BYE, r), decline: pick(DECLINE, r),
          answers: {}, talking: false,
        });
        id++;
      }
    });
    return out;
  }

  /** Sheep live in the walled fields. */
  const inField = (x, y) => Wd.ground[Math.floor(y)] && Wd.ground[Math.floor(y)][Math.floor(x)] === 'field';
  function makeSheep(r, n) {
    const tiles = [];
    for (let y = 0; y < Wd.H; y++) for (let x = 0; x < Wd.W; x++) if (inField(x + 0.5, y + 0.5) && Wd.walkable(x, y)) tiles.push([x, y]);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = tiles[Math.floor(r() * tiles.length)];
      out.push({ sheep: true, x: t[0] + 0.5, y: t[1] + 0.5, tx: null, ty: null, wait: r() * 4, phase: r() * 6, moving: false, face: r() < 0.5 ? -1 : 1 });
    }
    return out;
  }

  const dirOf = (vx, vy) => {
    const sx = vx - vy, sy = vx + vy;
    return (sy >= 0 ? 's' : 'n') + (sx >= 0 ? 'e' : 'w');
  };

  /** Move along a path of waypoints. Returns true when the path is finished. */
  function follow(e, dt, speed) {
    if (!e.path || !e.path.length) return true;
    const wp = e.path[0];
    const dx = wp[0] - e.x, dy = wp[1] - e.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) { e.x = wp[0]; e.y = wp[1]; e.path.shift(); }
    else { e.x += (dx / d) * step; e.y += (dy / d) * step; }
    if (d > 0.001) e.dir = dirOf(dx, dy);
    e.moving = true;
    e.phase += dt * speed * 7.5;
    return !e.path.length;
  }

  function updateResident(p, dt, r) {
    if (p.talking) { p.moving = false; return; }
    if (p.wait > 0) { p.wait -= dt; p.moving = false; return; }
    if (!p.path || !p.path.length) {
      const allowed = (x, y) => Wd.districtAt(x, y) === p.district;
      let target;
      if (r() < 0.55) { const poi = pick(Wd.pois[p.district], r); target = [poi[0] + (r() - 0.5) * 1.2, poi[1] + (r() - 0.5) * 1.2]; }
      else {
        // a short stroll, not a cross-town march
        const tiles = Wd.districtTiles(p.district);
        for (let i = 0; i < 8; i++) { const t = tiles[Math.floor(r() * tiles.length)]; if (Math.hypot(t[0] - p.x, t[1] - p.y) < 9) { target = [t[0] + 0.5, t[1] + 0.5]; break; } }
      }
      if (!target) { p.wait = 1; return; }
      const path = Wd.findPath(p.x, p.y, target[0], target[1], allowed);
      if (!path || !path.length) { p.wait = 1 + r() * 2; return; }
      p.path = path;
    }
    if (follow(p, dt, p.speed)) { p.moving = false; p.wait = 1.5 + r() * 4.5; }
  }

  function updateSheep(s, dt, r) {
    if (s.wait > 0) { s.wait -= dt; s.moving = false; return; }
    if (s.tx == null) {
      const tx = s.x + (r() - 0.5) * 3, ty = s.y + (r() - 0.5) * 3;
      if (inField(tx, ty) && Wd.free(tx, ty, 0.3)) { s.tx = tx; s.ty = ty; } else { s.wait = 0.5; return; }
    }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = 0.55 * dt;
    if (d <= step) { s.tx = null; s.moving = false; s.wait = 2 + r() * 6; return; }
    const nx = s.x + (dx / d) * step, ny = s.y + (dy / d) * step;
    if (!Wd.free(nx, ny, 0.3)) { s.tx = null; s.wait = 1; return; }
    s.x = nx; s.y = ny; s.moving = true; s.phase += dt * 6;
    s.face = dx - dy >= 0 ? 1 : -1;
  }

  VP.People = { makeResidents, makeSheep, updateResident, updateSheep, follow, dirOf, makeLook };
})();
