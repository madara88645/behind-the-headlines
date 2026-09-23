/*
 * scenes.js - the four inline-SVG map scenes for the 5 KM zoom, plus the contour-line page texture.
 * Everything is drawn in code (no images). A seeded random generator keeps every render identical.
 * Exposes window.FiveKmScenes = { ireland, county, town, street, contours, HOME }.
 */
(function () {
  'use strict';

  var C = {
    field: '#DDE8CF', fieldDeep: '#9DBF86', hedge: '#3E6B3A', notice: '#FFD400', ink: '#151A14',
    sea: '#CFE0D1', seaLine: '#B3CDB9', town: '#34402F'
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function r1(n) { return Math.round(n * 10) / 10; }

  // Catmull-Rom spline through points -> cubic Bezier path.
  function smooth(P, closed) {
    var n = P.length, d = 'M' + r1(P[0][0]) + ' ' + r1(P[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = P[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      var p1 = P[i];
      var p2 = P[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      var p3 = P[closed ? (i + 2) % n : Math.min(i + 2, n - 1)];
      d += 'C' + r1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        r1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' +
        r1(p2[0]) + ' ' + r1(p2[1]);
    }
    return d + (closed ? 'Z' : '');
  }

  // A wobbly closed loop - used for contour rings.
  function loop(cx, cy, r, sx, ph) {
    var pts = [];
    for (var i = 0; i < 40; i++) {
      var a = (i / 40) * Math.PI * 2;
      var rr = r * (1 + 0.17 * Math.sin(2 * a + ph[0]) + 0.08 * Math.sin(3 * a + ph[1]) + 0.04 * Math.sin(5 * a + ph[2]));
      pts.push([cx + rr * Math.cos(a) * sx, cy + rr * Math.sin(a)]);
    }
    return smooth(pts, true);
  }
  function hill(cx, cy, rings, step, sx, seed, style) {
    var R = rng(seed), ph = [R() * 6, R() * 6, R() * 6], out = '';
    for (var k = 1; k <= rings; k++) {
      var p2 = [ph[0] + k * 0.18, ph[1] - k * 0.11, ph[2] + k * 0.07];
      out += '<path d="' + loop(cx, cy, k * step, sx, p2) + '" ' + style + '/>';
    }
    return out;
  }

  // Map pin that marks "you" in every scene (the zoom origin).
  function pin(x, y, s, label) {
    s = s || 1;
    return '<g class="pin" transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<circle class="pin-pulse" r="15" fill="none" stroke="' + C.ink + '" stroke-width="2"/>' +
      '<ellipse cx="0" cy="1" rx="7" ry="2.4" fill="' + C.ink + '" opacity=".25"/>' +
      '<path d="M0 0C-8-11-12-17-12-23A12 12 0 1 1 12-23C12-17 8-11 0 0Z" fill="' + C.ink + '"/>' +
      '<circle cy="-23" r="5" fill="' + C.notice + '"/>' +
      (label ? '<text x="16" y="-26" class="svg-label" paint-order="stroke" stroke="#F4F7EE" stroke-width="4" stroke-linejoin="round">' + label + '</text>' : '') +
      '</g>';
  }

  var HOME = { x: 324.8, y: 265 }; // midlands, in scene-1 coordinates

  var IRELAND = 'M338.5 52.0C343.6 52.7 362.7 62.2 364.7 67.0C366.7 71.8 351.8 83.1 351.6 84.0C351.4 84.9 359.0 75.2 363.5 73.0C368.0 70.7 374.2 69.9 381.4 69.0C388.5 68.1 405.9 66.7 411.2 67.0C416.5 67.3 414.9 68.0 416.5 71.0C418.2 74.0 419.6 81.9 421.9 87.0C424.2 92.1 429.6 100.3 432.0 105.0C434.5 109.6 439.2 114.7 438.0 118.0C436.8 121.3 424.0 126.1 424.3 127.0C424.6 127.9 435.3 122.4 439.8 124.0C444.3 125.7 453.0 133.8 454.1 138.0C455.2 142.2 449.0 147.6 446.9 152.0C444.9 156.3 443.4 164.3 440.4 167.0C437.3 169.7 430.6 167.3 426.7 170.0C422.7 172.7 418.3 182.0 414.2 185.0C410.0 188.0 400.3 186.3 399.3 190.0C398.2 193.8 406.1 205.8 407.0 210.0C407.9 214.2 404.1 214.7 405.2 218.0C406.3 221.3 412.4 226.9 414.2 232.0C415.9 237.1 418.0 248.4 417.1 252.0C416.2 255.6 408.6 254.3 408.2 256.0C407.8 257.6 413.1 260.9 414.2 263.0C415.2 265.1 414.5 265.5 415.4 270.0C416.2 274.5 420.6 287.0 420.1 293.0C419.7 299.0 414.2 303.9 412.4 310.0C410.6 316.2 410.6 327.1 408.2 334.0C405.8 340.9 397.5 351.3 396.3 356.0C395.0 360.6 399.5 362.4 399.9 365.0C400.2 367.6 400.8 372.2 398.7 373.0C396.5 373.7 390.6 369.2 385.6 370.0C380.5 370.7 368.4 378.3 364.7 378.0C360.9 377.7 362.5 368.5 360.5 368.0C358.6 367.6 356.9 372.9 351.6 375.0C346.2 377.1 329.9 379.0 324.8 382.0C319.7 385.0 319.8 392.9 317.6 395.0C315.4 397.1 312.4 394.1 309.9 396.0C307.4 398.0 304.8 405.9 300.9 408.0C297.1 410.1 289.0 406.7 284.2 410.0C279.5 413.3 274.9 427.0 269.3 430.0C263.8 433.0 255.1 428.2 247.3 430.0C239.5 431.8 225.7 439.8 217.5 442.0C209.3 444.3 193.3 448.0 192.4 445.0C191.6 442.0 214.5 424.3 211.5 422.0C208.6 419.8 175.0 432.2 172.8 430.0C170.5 427.7 198.4 411.5 196.6 407.0C194.8 402.5 161.3 403.3 160.9 400.0C160.4 396.7 194.8 388.0 193.6 385.0C192.5 382.0 156.7 383.3 153.1 380.0C149.5 376.7 164.2 365.2 169.8 363.0C175.4 360.7 188.2 367.3 190.7 365.0C193.1 362.8 183.7 352.5 185.9 348.0C188.1 343.5 205.6 337.1 205.6 335.0C205.6 332.9 184.6 338.5 185.9 334.0C187.2 329.5 210.4 310.8 214.5 305.0C218.6 299.1 211.7 299.5 213.3 295.0C214.9 290.5 221.5 279.8 225.2 275.0C229.0 270.2 238.6 264.3 238.3 263.0C238.1 261.6 233.7 267.9 223.4 266.0C213.2 264.0 176.1 253.9 169.8 250.0C163.5 246.1 178.1 243.0 181.7 240.0C185.3 237.0 195.4 236.7 193.6 230.0C191.9 223.2 171.6 204.0 169.8 195.0C168.0 186.0 179.8 175.2 181.7 170.0C183.6 164.7 176.5 161.8 182.3 160.0C188.1 158.2 213.4 156.8 220.5 158.0C227.5 159.2 222.7 167.7 229.4 168.0C236.1 168.3 258.5 163.8 265.2 160.0C271.9 156.3 270.5 147.8 274.1 143.0C277.7 138.2 289.0 130.3 289.0 128.0C289.0 125.8 279.5 128.6 274.1 128.0C268.7 127.4 253.2 127.5 253.2 124.0C253.2 120.6 271.6 110.1 274.1 105.0C276.6 99.9 268.4 94.5 269.9 90.0C271.4 85.5 279.4 78.3 284.2 75.0C289.1 71.7 297.8 69.5 302.1 68.0C306.4 66.5 309.7 65.9 312.8 65.0C316.0 64.1 320.7 60.0 323.0 62.0C325.2 63.9 326.6 78.0 327.7 78.0C328.9 78.0 329.1 65.9 330.7 62.0C332.3 58.1 333.4 51.2 338.5 52.0Z';

  function open(label) {
    return '<svg viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + label + '">';
  }
  function gridLines(step, color, op) {
    var g = '<g stroke="' + color + '" stroke-opacity="' + op + '" stroke-width="1">';
    for (var x = step; x < 600; x += step) g += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="500"/>';
    for (var y = step; y < 500; y += step) g += '<line x1="0" y1="' + y + '" x2="600" y2="' + y + '"/>';
    return g + '</g>';
  }

  /* 1 - Ireland */
  function ireland() {
    var s = open('Map of Ireland with a pin in the midlands');
    s += '<defs><pattern id="sc-sea" width="12" height="7" patternUnits="userSpaceOnUse"><line x1="0" y1="3.5" x2="12" y2="3.5" stroke="' + C.seaLine + '" stroke-width="1"/></pattern>' +
      '<clipPath id="sc-land"><path d="' + IRELAND + '"/></clipPath></defs>';
    s += '<rect width="600" height="500" fill="' + C.sea + '"/><rect width="600" height="500" fill="url(#sc-sea)"/>';
    s += gridLines(100, C.hedge, 0.18);
    s += '<path d="' + IRELAND + '" fill="none" stroke="' + C.seaLine + '" stroke-width="10" stroke-linejoin="round"/>';
    s += '<path d="' + IRELAND + '" fill="' + C.fieldDeep + '" stroke="' + C.hedge + '" stroke-width="1.8" stroke-linejoin="round"/>';
    s += '<g clip-path="url(#sc-land)" fill="none" stroke="' + C.hedge + '" stroke-opacity=".32" stroke-width="1">' +
      hill(405, 300, 5, 9, 0.8, 11, '') + hill(205, 395, 5, 10, 1.3, 7, '') + hill(290, 95, 4, 10, 1.2, 3, '') +
      hill(250, 205, 3, 12, 1.4, 21, '') + hill(360, 150, 3, 10, 1, 5, '') + '</g>';
    s += '<g font-family="IBM Plex Mono, ui-monospace, monospace" font-size="11" letter-spacing="3" fill="' + C.hedge + '" opacity=".85">' +
      '<text x="60" y="250" transform="rotate(-90 60 250)" text-anchor="middle">ATLANTIC OCEAN</text>' +
      '<text x="520" y="330" text-anchor="middle">IRISH SEA</text><text x="520" y="345" text-anchor="middle" font-size="9" letter-spacing="1">(MUIR ÉIREANN)</text></g>';
    s += pin(HOME.x, HOME.y, 1, 'YOU');
    return s + '</svg>';
  }

  /* 2 - your county: field patchwork, hedges, river, roads, towns, a 5 km ring */
  function county() {
    var R = rng(42), s = open('County map with fields, a river, roads and your town inside a 5 kilometre ring');
    s += '<defs><pattern id="sc-crop" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><line x1="0" y1="0" x2="0" y2="6" stroke="' + C.hedge + '" stroke-opacity=".22" stroke-width="1"/></pattern></defs>';
    s += '<rect width="600" height="500" fill="#AECB97"/>';
    var cols = 8, rows = 7, P = [];
    for (var j = 0; j <= rows; j++) {
      P[j] = [];
      for (var i = 0; i <= cols; i++) {
        P[j][i] = [-50 + i * (700 / cols) + (R() - 0.5) * 44, -50 + j * (600 / rows) + (R() - 0.5) * 40];
      }
    }
    var fills = ['#9DBF86', '#AECB97', '#BCD5A6', '#93B87C', '#C6DBB1', '#A7C690', '#B6D09F'];
    var fieldG = '<g stroke="' + C.hedge + '" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round">';
    var extra = '';
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
        var poly = [a, b, c, d].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ');
        if (R() < 0.35) {
          var tri1 = [a, b, c].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ');
          var tri2 = [a, c, d].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ');
          fieldG += '<polygon points="' + tri1 + '" fill="' + fills[(R() * fills.length) | 0] + '"/>';
          fieldG += '<polygon points="' + tri2 + '" fill="' + fills[(R() * fills.length) | 0] + '"/>';
        } else {
          fieldG += '<polygon points="' + poly + '" fill="' + fills[(R() * fills.length) | 0] + '"/>';
          if (R() < 0.3) extra += '<polygon points="' + poly + '" fill="url(#sc-crop)" stroke="none"/>';
        }
      }
    }
    s += fieldG + '</g>' + extra;
    // woods
    var woods = [[110, 90, 26], [470, 330, 30], [70, 400, 22], [520, 60, 18], [210, 420, 20]];
    s += '<g fill="#6E9A62" stroke="' + C.hedge + '" stroke-width="1">';
    woods.forEach(function (w) {
      for (var k = 0; k < 16; k++) {
        var ang = R() * Math.PI * 2, rr = Math.sqrt(R()) * w[2];
        s += '<circle cx="' + r1(w[0] + Math.cos(ang) * rr * 1.3) + '" cy="' + r1(w[1] + Math.sin(ang) * rr) + '" r="' + r1(3.5 + R() * 2.5) + '"/>';
      }
    });
    s += '</g>';
    // contours on a hill
    s += '<g fill="none" stroke="' + C.hedge + '" stroke-opacity=".45" stroke-width="1.1">' + hill(505, 85, 6, 13, 1.25, 9, '') + hill(95, 455, 4, 14, 1.4, 17, '') + '</g>';
    // river
    var river = smooth([[-20, 118], [70, 150], [160, 205], [215, 300], [318, 338], [420, 352], [510, 420], [620, 462]], false);
    s += '<path d="' + river + '" fill="none" stroke="#5F8B5A" stroke-width="13" stroke-linecap="round"/>';
    s += '<path d="' + river + '" fill="none" stroke="' + C.sea + '" stroke-width="9" stroke-linecap="round"/>';
    // roads
    var roads = [
      { p: [[-20, 300], [120, 282], [240, 262], [300, 250], [380, 222], [480, 160], [620, 118]], w: 9 },
      { p: [[300, 250], [312, 330], [292, 420], [304, 520]], w: 7 },
      { p: [[300, 250], [252, 170], [232, 60], [252, -20]], w: 7 },
      { p: [[120, 282], [110, 360], [60, 470]], w: 5 }
    ];
    roads.forEach(function (rd) { s += '<path d="' + smooth(rd.p, false) + '" fill="none" stroke="' + C.ink + '" stroke-opacity=".75" stroke-width="' + (rd.w + 2.5) + '" stroke-linecap="round"/>'; });
    roads.forEach(function (rd) { s += '<path d="' + smooth(rd.p, false) + '" fill="none" stroke="#F7F1D2" stroke-width="' + rd.w + '" stroke-linecap="round"/>'; });
    // county boundary (dash-dot)
    s += '<path d="' + smooth([[160, -20], [138, 70], [70, 140], [44, 250], [-20, 330]], false) + '" fill="none" stroke="' + C.ink + '" stroke-opacity=".6" stroke-width="1.8" stroke-dasharray="12 5 2 5"/>';
    // towns
    function townBlob(cx, cy, n, rad) {
      var g = '<g fill="' + C.town + '">';
      for (var k = 0; k < n; k++) {
        var ang = R() * Math.PI * 2, rr = 8 + Math.sqrt(R()) * rad;
        var w = 4 + R() * 6, h = 4 + R() * 5, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.8;
        g += '<rect x="' + r1(x - w / 2) + '" y="' + r1(y - h / 2) + '" width="' + r1(w) + '" height="' + r1(h) + '" transform="rotate(' + r1((R() - 0.5) * 40) + ' ' + r1(x) + ' ' + r1(y) + ')"/>';
      }
      return g + '</g>';
    }
    s += townBlob(300, 256, 34, 34) + townBlob(118, 290, 12, 18) + townBlob(474, 170, 14, 18) + townBlob(246, 96, 9, 14) + townBlob(300, 424, 8, 12);
    // 5 km ring
    s += '<circle cx="300" cy="250" r="122" fill="' + C.notice + '" fill-opacity=".10" stroke="' + C.ink + '" stroke-width="1.8" stroke-dasharray="7 6"/>';
    s += '<g transform="translate(386 164)"><rect x="-4" y="-15" width="46" height="21" rx="2" fill="' + C.ink + '"/><text x="19" y="0" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="12" font-weight="600" fill="' + C.notice + '">5 km</text></g>';
    s += pin(300, 250, 1, 'YOU');
    return s + '</svg>';
  }

  /* 3 - your town: street grid, houses, park, river, the proposed site */
  function town() {
    var R = rng(7), s = open('Town street map with your home and a proposed data centre site at the edge of town');
    s += '<defs><pattern id="sc-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="' + C.ink + '" stroke-opacity=".55" stroke-width="1.6"/></pattern></defs>';
    s += '<rect width="600" height="500" fill="#E6EDDB"/>';
    s += '<g transform="rotate(-10 300 250)">';
    var xs = [-120, 0, 120, 240, 360, 480, 600, 720], ys = [-110, 10, 130, 250, 370, 490, 610];
    // blocks
    for (var j = 0; j < ys.length - 1; j++) {
      for (var i = 0; i < xs.length - 1; i++) {
        var x = xs[i] + 12, y = ys[j] + 12, w = 96, h = 96;
        var key = i + ',' + j;
        if (key === '5,1' || key === '6,1' || key === '5,0' || key === '6,0') continue; // proposed site area
        if (key === '1,3' || key === '1,4') { // park
          s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + C.fieldDeep + '" stroke="' + C.hedge + '" stroke-width="1.2"/>';
          for (var t = 0; t < 9; t++) s += '<circle cx="' + r1(x + 12 + R() * 72) + '" cy="' + r1(y + 12 + R() * 72) + '" r="' + r1(5 + R() * 4) + '" fill="#6E9A62" stroke="' + C.hedge + '" stroke-width="1"/>';
          continue;
        }
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#CFDABF" stroke="#A9B79A" stroke-width="1"/>';
        // houses along the block edges
        var g = '<g fill="#6D7766" stroke="#4E5748" stroke-width=".8">';
        for (var k = 0; k < 5; k++) {
          g += '<rect x="' + r1(x + 4 + k * 18.4) + '" y="' + (y + 4) + '" width="15" height="' + r1(18 + R() * 8) + '"/>';
          g += '<rect x="' + r1(x + 4 + k * 18.4) + '" y="' + r1(y + h - 22 - R() * 6) + '" width="15" height="' + 18 + '"/>';
        }
        s += g + '</g>';
      }
    }
    // proposed site
    s += '<rect x="492" y="-98" width="216" height="216" fill="#D9E3C9"/><rect x="492" y="-98" width="216" height="216" fill="url(#sc-hatch)"/>';
    s += '<rect x="520" y="-40" width="150" height="120" fill="#F4F7EE" fill-opacity=".85" stroke="' + C.ink + '" stroke-width="2.2" stroke-dasharray="9 5"/>';
    s += '</g>';
    // streets on top (straight grid, same rotation)
    s += '<g transform="rotate(-10 300 250)">';
    var streetW = 16;
    xs.forEach(function (x) { s += '<rect x="' + (x - streetW / 2 + 6) + '" y="-200" width="' + streetW + '" height="900" fill="#FBFAF2" stroke="#9AA58D" stroke-width="1"/>'; });
    ys.forEach(function (y) { s += '<rect x="-200" y="' + (y - streetW / 2 + 6) + '" width="1000" height="' + streetW + '" fill="#FBFAF2" stroke="#9AA58D" stroke-width="1"/>'; });
    // main street
    s += '<rect x="-200" y="' + (256 - 13) + '" width="1000" height="26" fill="' + C.ink + '" fill-opacity=".75"/>';
    s += '<rect x="-200" y="' + (256 - 10) + '" width="1000" height="20" fill="#F7EDB8"/>';
    s += '</g>';
    // river across the lower left
    var river = smooth([[-20, 400], [90, 430], [190, 470], [270, 520]], false);
    s += '<path d="' + river + '" fill="none" stroke="#5F8B5A" stroke-width="30"/><path d="' + river + '" fill="none" stroke="' + C.sea + '" stroke-width="25"/>';
    // site label
    s += '<g transform="translate(470 60)"><rect x="-4" y="-16" width="136" height="22" fill="' + C.ink + '"/><text x="64" y="0" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="11" font-weight="600" letter-spacing="1" fill="' + C.notice + '">PROPOSED SITE</text></g>';
    s += '<g transform="translate(560 108)"><rect x="-1.5" y="0" width="3" height="18" fill="#6B4F2A"/><rect x="-10" y="-12" width="20" height="14" fill="' + C.notice + '" stroke="' + C.ink + '" stroke-width="1"/></g>';
    s += pin(300, 250, 1, 'YOU');
    return s + '</svg>';
  }

  /* 4 - your street, side view: terrace, hedges, road, a turbine and the data centre on the hill */
  function street() {
    var s = open('Your street: a terrace of houses, a planning notice on a post, a wind turbine and a large data centre building on the hill behind');
    s += '<defs><linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1F6EA"/><stop offset="1" stop-color="#DCE8CE"/></linearGradient></defs>';
    s += '<rect width="600" height="500" fill="url(#sc-sky)"/>';
    // clouds
    s += '<g fill="#FFFFFF" opacity=".75"><ellipse cx="120" cy="70" rx="46" ry="12"/><ellipse cx="148" cy="62" rx="28" ry="12"/><ellipse cx="430" cy="48" rx="38" ry="9"/><ellipse cx="452" cy="42" rx="20" ry="9"/></g>';
    // hills
    s += '<path d="M0 262C80 232 160 226 250 240S420 212 600 226V500H0Z" fill="#BCD5A6"/>';
    s += '<g fill="none" stroke="' + C.hedge + '" stroke-opacity=".25" stroke-width="1"><path d="M0 276C90 250 170 246 250 256S420 232 600 244"/><path d="M0 292C90 268 170 264 250 272S420 252 600 262"/></g>';
    // data centre on the hill (big, low, grey)
    var dx = 266;
    s += '<g><rect x="' + dx + '" y="214" width="236" height="46" fill="#848B80" stroke="' + C.ink + '" stroke-width="1.5"/>' +
      '<rect x="' + dx + '" y="206" width="236" height="9" fill="#6E756A" stroke="' + C.ink + '" stroke-width="1.5"/>';
    for (var v = 0; v < 8; v++) s += '<rect x="' + (dx + 14 + v * 28) + '" y="196" width="14" height="10" fill="#9AA196" stroke="' + C.ink + '" stroke-width="1"/>';
    for (v = 0; v < 12; v++) s += '<rect x="' + (dx + 10 + v * 19) + '" y="226" width="10" height="24" fill="#737A6F"/>';
    s += '</g>';
    s += '<g transform="translate(' + (dx + 118) + ' 184)"><rect x="-82" y="-14" width="164" height="19" fill="' + C.ink + '"/><text x="0" y="0" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="10.5" font-weight="600" letter-spacing="1" fill="' + C.notice + '">PROPOSED DATA CENTRE</text></g>';
    // nearer hill
    s += '<path d="M0 300C120 280 220 290 320 296S500 280 600 290V500H0Z" fill="' + C.fieldDeep + '"/>';
    // wind turbine (right, clear of the meter)
    var bl = '<path d="M550 104L546 50L550 38L554 50Z" fill="#F7F8F2" stroke="' + C.ink + '" stroke-width="1.3" stroke-linejoin="round"';
    s += '<g><path d="M546 300L550 108L554 300Z" fill="#F7F8F2" stroke="' + C.ink + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<g class="blades">' + bl + '/>' + bl + ' transform="rotate(120 550 104)"/>' + bl + ' transform="rotate(240 550 104)"/></g>' +
      '<circle cx="550" cy="104" r="5" fill="#F7F8F2" stroke="' + C.ink + '" stroke-width="1.4"/></g>';
    // terrace of houses
    var walls = ['#F3E7C8', '#E9D3C1', '#DDE6D0', '#F5EFDD', '#E4DCCB'];
    var doors = ['#1F6E8C', '#B8322A', '#FFD400', '#3E6B3A', '#151A14'];
    var hx = 40, bw = 104;
    for (var h = 0; h < 5; h++) {
      var x = hx + h * bw, top = 300 + (h % 2 ? 6 : 0), base = 404;
      s += '<rect x="' + (x + 70) + '" y="' + (top - 38) + '" width="12" height="22" fill="#8A6F5A" stroke="' + C.ink + '" stroke-width="1.3"/>';
      s += '<path d="M' + (x - 4) + ' ' + top + 'L' + (x + 22) + ' ' + (top - 34) + 'H' + (x + bw - 22) + 'L' + (x + bw + 4) + ' ' + top + 'Z" fill="#3E463C" stroke="' + C.ink + '" stroke-width="1.4" stroke-linejoin="round"/>';
      s += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + (base - top) + '" fill="' + walls[h] + '" stroke="' + C.ink + '" stroke-width="1.4"/>';
      // windows
      s += '<g fill="#CFE0D1" stroke="' + C.ink + '" stroke-width="1.3">' +
        '<rect x="' + (x + 14) + '" y="' + (top + 14) + '" width="26" height="30"/><rect x="' + (x + 62) + '" y="' + (top + 14) + '" width="26" height="30"/>' +
        '<rect x="' + (x + 14) + '" y="' + (top + 60) + '" width="26" height="30"/></g>';
      s += '<g stroke="' + C.ink + '" stroke-width="1"><line x1="' + (x + 27) + '" y1="' + (top + 14) + '" x2="' + (x + 27) + '" y2="' + (top + 44) + '"/><line x1="' + (x + 75) + '" y1="' + (top + 14) + '" x2="' + (x + 75) + '" y2="' + (top + 44) + '"/><line x1="' + (x + 27) + '" y1="' + (top + 60) + '" x2="' + (x + 27) + '" y2="' + (top + 90) + '"/></g>';
      // door with fanlight
      s += '<path d="M' + (x + 60) + ' ' + base + 'V' + (top + 64) + 'A14 14 0 0 1 ' + (x + 88) + ' ' + (top + 64) + 'V' + base + 'Z" fill="' + doors[h] + '" stroke="' + C.ink + '" stroke-width="1.4"/>';
      s += '<path d="M' + (x + 62) + ' ' + (top + 64) + 'A12 12 0 0 1 ' + (x + 86) + ' ' + (top + 64) + 'Z" fill="#F7F8F2" stroke="' + C.ink + '" stroke-width="1"/>';
      s += '<circle cx="' + (x + 82) + '" cy="' + (top + 84) + '" r="1.8" fill="' + C.ink + '"/>';
    }
    // hedges and pavement
    s += '<rect x="0" y="404" width="600" height="20" fill="#C9CEC0" stroke="' + C.ink + '" stroke-width="1.2"/>';
    s += '<g fill="' + C.hedge + '" stroke="' + C.ink + '" stroke-width="1.1">';
    for (h = 0; h < 5; h++) s += '<rect x="' + (hx + h * bw + 6) + '" y="386" width="44" height="20" rx="9"/>';
    s += '<rect x="-10" y="388" width="44" height="18" rx="9"/><rect x="566" y="388" width="44" height="18" rx="9"/></g>';
    // road
    s += '<rect x="0" y="424" width="600" height="76" fill="#5B6158"/>';
    s += '<g fill="#EDEEE2">';
    for (var dsh = 0; dsh < 600; dsh += 56) s += '<rect x="' + (dsh + 8) + '" y="459" width="30" height="5"/>';
    s += '</g>';
    // the site notice on its post
    s += '<g transform="translate(22 330)"><rect x="12" y="10" width="7" height="72" fill="#6B4F2A" stroke="' + C.ink + '" stroke-width="1.2"/>' +
      '<rect x="-2" y="0" width="36" height="44" fill="' + C.notice + '" stroke="' + C.ink + '" stroke-width="1.3"/>' +
      '<rect x="3" y="5" width="26" height="4" fill="' + C.ink + '"/><g stroke="' + C.ink + '" stroke-width="1"><line x1="3" y1="15" x2="29" y2="15"/><line x1="3" y1="21" x2="29" y2="21"/><line x1="3" y1="27" x2="24" y2="27"/><line x1="3" y1="33" x2="27" y2="33"/></g></g>';
    s += pin(300, 286, 1, 'YOU');
    return s + '</svg>';
  }

  /* Page texture: organic contour rings as an SVG data URL. */
  function contours() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#3E6B3A" stroke-opacity=".13" stroke-width="1.2">';
    s += hill(1330, 170, 13, 34, 1.25, 4, '') + hill(170, 930, 11, 36, 1.3, 12, '') + hill(820, 560, 5, 30, 1.6, 30, '');
    s += '</g></svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) + '")';
  }

  window.FiveKmScenes = { ireland: ireland, county: county, town: town, street: street, contours: contours, HOME: HOME };
})();
