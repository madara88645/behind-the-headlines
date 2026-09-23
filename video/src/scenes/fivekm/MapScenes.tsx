import React, { useMemo } from "react";
import { random } from "remotion";
import { F, KM } from "../../theme";
import { IRELAND_HOME, IRELAND_PATH } from "./ireland";

/**
 * The four zoom levels of 5 KM, drawn in code (600 x 500 viewBox, like the game):
 * Ireland -> your county -> your town -> your street. Deterministic: random() is seeded.
 */

const W = 600;
const H = 500;

const smooth = (P: [number, number][], closed = false) => {
  const n = P.length;
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
    const p1 = P[i];
    const p2 = P[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const p3 = P[closed ? (i + 2) % n : Math.min(i + 2, n - 1)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(
      p2[0] -
      (p3[0] - p1[0]) / 6
    ).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (closed ? "Z" : "");
};

/** Wobbly contour rings around a hill. */
export const hillRings = (cx: number, cy: number, rings: number, step: number, sx: number, seed: string) => {
  const ph = [random(seed + "a") * 6, random(seed + "b") * 6, random(seed + "c") * 6];
  const out: string[] = [];
  for (let k = 1; k <= rings; k++) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rr =
        k *
        step *
        (1 +
          0.17 * Math.sin(2 * a + ph[0] + k * 0.18) +
          0.08 * Math.sin(3 * a + ph[1] - k * 0.11) +
          0.04 * Math.sin(5 * a + ph[2] + k * 0.07));
      pts.push([cx + rr * Math.cos(a) * sx, cy + rr * Math.sin(a)]);
    }
    out.push(smooth(pts, true));
  }
  return out;
};

export const Pin: React.FC<{ x: number; y: number; s?: number; label?: string }> = ({ x, y, s = 1, label }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={1} rx={7} ry={2.4} fill={KM.ink} opacity={0.25} />
    <path d="M0 0C-8-11-12-17-12-23A12 12 0 1 1 12-23C12-17 8-11 0 0Z" fill={KM.ink} />
    <circle cy={-23} r={5} fill={KM.notice} />
    {label && (
      <text
        x={16}
        y={-26}
        fontFamily={F.mono}
        fontWeight={600}
        fontSize={13}
        fill={KM.ink}
        stroke="#F4F7EE"
        strokeWidth={4}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {label}
      </text>
    )}
  </g>
);

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    {children}
  </svg>
);

export const SceneIreland: React.FC = () => {
  const hills = useMemo(
    () => [
      ...hillRings(405, 300, 5, 9, 0.8, "h1"),
      ...hillRings(205, 395, 5, 10, 1.3, "h2"),
      ...hillRings(290, 95, 4, 10, 1.2, "h3"),
      ...hillRings(250, 205, 3, 12, 1.4, "h4"),
    ],
    [],
  );
  return (
    <Frame>
      <defs>
        <pattern id="km-sea" width={12} height={7} patternUnits="userSpaceOnUse">
          <line x1={0} y1={3.5} x2={12} y2={3.5} stroke={KM.seaLine} strokeWidth={1} />
        </pattern>
        <clipPath id="km-land">
          <path d={IRELAND_PATH} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={KM.sea} />
      <rect width={W} height={H} fill="url(#km-sea)" />
      <path d={IRELAND_PATH} fill="none" stroke={KM.seaLine} strokeWidth={10} strokeLinejoin="round" />
      <path d={IRELAND_PATH} fill={KM.fieldDeep} stroke={KM.hedge} strokeWidth={1.8} strokeLinejoin="round" />
      <g clipPath="url(#km-land)" fill="none" stroke={KM.hedge} strokeOpacity={0.32} strokeWidth={1}>
        {hills.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fontFamily={F.mono} fontSize={11} letterSpacing={3} fill={KM.hedge} opacity={0.85}>
        <text x={60} y={250} transform="rotate(-90 60 250)" textAnchor="middle">
          ATLANTIC OCEAN
        </text>
        <text x={520} y={330} textAnchor="middle">
          IRISH SEA
        </text>
      </g>
      <Pin x={IRELAND_HOME.x} y={IRELAND_HOME.y} label="YOU" />
    </Frame>
  );
};

export const SceneCounty: React.FC = () => {
  const fields = useMemo(() => {
    const cols = 8;
    const rows = 7;
    const P: [number, number][][] = [];
    for (let j = 0; j <= rows; j++) {
      P[j] = [];
      for (let i = 0; i <= cols; i++) {
        P[j][i] = [
          -50 + i * (700 / cols) + (random(`cx${i}-${j}`) - 0.5) * 44,
          -50 + j * (600 / rows) + (random(`cy${i}-${j}`) - 0.5) * 40,
        ];
      }
    }
    const fills = ["#9DBF86", "#AECB97", "#BCD5A6", "#93B87C", "#C6DBB1", "#A7C690", "#B6D09F"];
    const polys: { pts: string; fill: string }[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const q = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]];
        polys.push({
          pts: q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
          fill: fills[Math.floor(random(`f${i}-${j}`) * fills.length)],
        });
      }
    }
    return polys;
  }, []);
  const town = useMemo(
    () =>
      Array.from({ length: 36 }, (_, k) => {
        const a = random(`ta${k}`) * Math.PI * 2;
        const r = 8 + Math.sqrt(random(`tr${k}`)) * 34;
        return {
          x: 300 + Math.cos(a) * r,
          y: 256 + Math.sin(a) * r * 0.8,
          w: 4 + random(`tw${k}`) * 6,
          h: 4 + random(`th${k}`) * 5,
          rot: (random(`tt${k}`) - 0.5) * 40,
        };
      }),
    [],
  );
  const river = smooth([
    [-20, 118],
    [70, 150],
    [160, 205],
    [215, 300],
    [318, 338],
    [420, 352],
    [510, 420],
    [620, 462],
  ]);
  const roads = [
    smooth([
      [-20, 300],
      [120, 282],
      [240, 262],
      [300, 250],
      [380, 222],
      [480, 160],
      [620, 118],
    ]),
    smooth([
      [300, 250],
      [312, 330],
      [292, 420],
      [304, 520],
    ]),
    smooth([
      [300, 250],
      [252, 170],
      [232, 60],
      [252, -20],
    ]),
  ];
  return (
    <Frame>
      <rect width={W} height={H} fill="#AECB97" />
      <g stroke={KM.hedge} strokeOpacity={0.55} strokeWidth={1.6} strokeLinejoin="round">
        {fields.map((p, i) => (
          <polygon key={i} points={p.pts} fill={p.fill} />
        ))}
      </g>
      <path d={river} fill="none" stroke="#5F8B5A" strokeWidth={13} strokeLinecap="round" />
      <path d={river} fill="none" stroke={KM.sea} strokeWidth={9} strokeLinecap="round" />
      {roads.map((d, i) => (
        <path key={`a${i}`} d={d} fill="none" stroke={KM.ink} strokeOpacity={0.75} strokeWidth={10} strokeLinecap="round" />
      ))}
      {roads.map((d, i) => (
        <path key={`b${i}`} d={d} fill="none" stroke="#F7F1D2" strokeWidth={7} strokeLinecap="round" />
      ))}
      <g fill={KM.town}>
        {town.map((t, i) => (
          <rect
            key={i}
            x={t.x - t.w / 2}
            y={t.y - t.h / 2}
            width={t.w}
            height={t.h}
            transform={`rotate(${t.rot} ${t.x} ${t.y})`}
          />
        ))}
      </g>
      <circle cx={300} cy={250} r={122} fill={KM.notice} fillOpacity={0.12} stroke={KM.ink} strokeWidth={1.8} strokeDasharray="7 6" />
      <g transform="translate(386 164)">
        <rect x={-4} y={-15} width={46} height={21} rx={2} fill={KM.ink} />
        <text x={19} y={0} textAnchor="middle" fontFamily={F.mono} fontSize={12} fontWeight={600} fill={KM.notice}>
          5 km
        </text>
      </g>
      <Pin x={300} y={250} label="YOU" />
    </Frame>
  );
};

export const SceneTown: React.FC = () => {
  const xs = [-120, 0, 120, 240, 360, 480, 600, 720];
  const ys = [-110, 10, 130, 250, 370, 490, 610];
  const blocks = useMemo(() => {
    const b: { x: number; y: number; park: boolean; key: string }[] = [];
    for (let j = 0; j < ys.length - 1; j++) {
      for (let i = 0; i < xs.length - 1; i++) {
        const key = `${i},${j}`;
        if (["5,1", "6,1", "5,0", "6,0"].includes(key)) continue;
        b.push({ x: xs[i] + 12, y: ys[j] + 12, park: key === "1,3" || key === "1,4", key });
      }
    }
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Frame>
      <defs>
        <pattern id="km-hatch" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={KM.ink} strokeOpacity={0.55} strokeWidth={1.6} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#E6EDDB" />
      <g transform="rotate(-10 300 250)">
        {blocks.map((b) =>
          b.park ? (
            <rect key={b.key} x={b.x} y={b.y} width={96} height={96} rx={4} fill={KM.fieldDeep} stroke={KM.hedge} strokeWidth={1.2} />
          ) : (
            <g key={b.key}>
              <rect x={b.x} y={b.y} width={96} height={96} rx={3} fill="#CFDABF" stroke="#A9B79A" strokeWidth={1} />
              {Array.from({ length: 5 }, (_, k) => (
                <React.Fragment key={k}>
                  <rect
                    x={b.x + 4 + k * 18.4}
                    y={b.y + 4}
                    width={15}
                    height={18 + random(`hh${b.key}${k}`) * 8}
                    fill="#6D7766"
                    stroke="#4E5748"
                    strokeWidth={0.8}
                  />
                  <rect x={b.x + 4 + k * 18.4} y={b.y + 74} width={15} height={18} fill="#6D7766" stroke="#4E5748" strokeWidth={0.8} />
                </React.Fragment>
              ))}
            </g>
          ),
        )}
        <rect x={492} y={-98} width={216} height={216} fill="#D9E3C9" />
        <rect x={492} y={-98} width={216} height={216} fill="url(#km-hatch)" />
        <rect x={520} y={-40} width={150} height={120} fill="#F4F7EE" fillOpacity={0.9} stroke={KM.ink} strokeWidth={2.2} strokeDasharray="9 5" />
        {xs.map((x) => (
          <rect key={`sx${x}`} x={x - 2} y={-200} width={16} height={900} fill="#FBFAF2" stroke="#9AA58D" strokeWidth={1} />
        ))}
        {ys.map((y) => (
          <rect key={`sy${y}`} x={-200} y={y - 2} width={1000} height={16} fill="#FBFAF2" stroke="#9AA58D" strokeWidth={1} />
        ))}
        <rect x={-200} y={243} width={1000} height={26} fill={KM.ink} fillOpacity={0.75} />
        <rect x={-200} y={246} width={1000} height={20} fill="#F7EDB8" />
      </g>
      <g transform="translate(468 118)">
        <rect x={0} y={-16} width={128} height={22} fill={KM.ink} />
        <text x={64} y={0} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={11} fill={KM.notice}>
          PROPOSED SITE
        </text>
      </g>
      <Pin x={300} y={250} label="YOU" />
    </Frame>
  );
};

const House: React.FC<{ x: number; w: number; h: number; color: string; roof: string }> = ({ x, w, h, color, roof }) => {
  const base = 380;
  return (
    <g>
      <rect x={x} y={base - h} width={w} height={h} fill={color} stroke={KM.ink} strokeWidth={2} />
      <path d={`M${x - 8} ${base - h} L${x + w / 2} ${base - h - 42} L${x + w + 8} ${base - h} Z`} fill={roof} stroke={KM.ink} strokeWidth={2} />
      <rect x={x + 12} y={base - h + 18} width={18} height={20} fill="#DCE7EA" stroke={KM.ink} strokeWidth={1.5} />
      <rect x={x + w - 30} y={base - h + 18} width={18} height={20} fill="#DCE7EA" stroke={KM.ink} strokeWidth={1.5} />
      <rect x={x + w / 2 - 10} y={base - 34} width={20} height={34} fill="#6B4F2A" stroke={KM.ink} strokeWidth={1.5} />
    </g>
  );
};

export const SceneStreet: React.FC<{ frame: number }> = ({ frame }) => {
  const blade = frame * 2.2;
  return (
    <Frame>
      <rect width={W} height={H} fill="#EAF1E1" />
      {/* sky + hill */}
      <path d="M0 290 C120 240 260 250 380 262 C470 270 540 250 600 236 L600 500 L0 500 Z" fill="#B9D3A2" />
      {/* the proposed data centre behind the houses */}
      <g>
        <rect x={300} y={196} width={200} height={92} fill="#7E8A86" stroke={KM.ink} strokeWidth={2} />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={312 + i * 26} y={212} width={14} height={60} fill="#5D6865" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={`v${i}`} x={314 + i * 30} y={184} width={16} height={12} fill="#5D6865" stroke={KM.ink} strokeWidth={1.2} />
        ))}
        <rect x={321} y={150} width={158} height={22} fill={KM.ink} />
        <text x={400} y={166} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={12} fill={KM.notice}>
          PROPOSED DATA CENTRE
        </text>
      </g>
      {/* wind turbine */}
      <g transform="translate(528 232)">
        <path d="M-3 0 L-1.5 -150 L1.5 -150 L3 0 Z" fill="#F4F7EE" stroke={KM.ink} strokeWidth={1.5} />
        <g transform={`translate(0 -150) rotate(${blade})`}>
          {[0, 120, 240].map((a) => (
            <path key={a} d="M0 0 L-3 -8 L0 -78 L4 -8 Z" fill="#F4F7EE" stroke={KM.ink} strokeWidth={1.5} transform={`rotate(${a})`} />
          ))}
          <circle r={5} fill="#F4F7EE" stroke={KM.ink} strokeWidth={1.5} />
        </g>
      </g>
      {/* houses */}
      <House x={30} w={96} h={110} color="#F1E3C8" roof="#3E4A3C" />
      <House x={150} w={96} h={124} color="#E9D0CB" roof="#3E4A3C" />
      <House x={270} w={96} h={112} color="#F4ECD8" roof="#3E4A3C" />
      <House x={390} w={96} h={120} color="#DCE3CF" roof="#3E4A3C" />
      <House x={510} w={96} h={108} color="#F1E3C8" roof="#3E4A3C" />
      {/* hedges + road */}
      <rect x={0} y={380} width={W} height={16} fill={KM.hedge} opacity={0.8} />
      <rect x={0} y={396} width={W} height={104} fill="#5E6660" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 64 + 10} y={444} width={36} height={6} fill="#F4F7EE" />
      ))}
      {/* the planning notice on its post */}
      <rect x={26} y={300} width={6} height={80} fill="#6B4F2A" />
      <rect x={6} y={270} width={46} height={40} fill={KM.notice} stroke={KM.ink} strokeWidth={1.5} />
      {[280, 288, 296].map((y) => (
        <rect key={y} x={12} y={y} width={34} height={3} fill={KM.ink} />
      ))}
      <Pin x={318} y={372} label="YOU" />
    </Frame>
  );
};
