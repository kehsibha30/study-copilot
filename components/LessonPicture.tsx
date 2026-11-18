"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Picture } from "@/lib/store";

// Lesson pictures (decision 7R). They play by themselves and loop. There is nothing to drag or tap.
// With "reduce motion" on, the picture holds its last frame instead of moving.

const QUERY = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}

// 0 to 1 over `ms`, then a short hold, then again.
function useLoop(ms: number, holdMs: number) {
  const reduced = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const begin = performance.now();
    let id = 0;
    const tick = (now: number) => {
      setP(Math.min(1, ((now - begin) % (ms + holdMs)) / ms));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [ms, holdMs, reduced]);
  return reduced ? 1 : p;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.min(1, Math.max(0, t));
const INK = "var(--ink)";
const MUTED = "var(--muted)";
const WARM = "#c4532d";

function Frame({ label, caption, children }: { label: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="pic" role="img" aria-label={label}>
      {children}
      <figcaption className="piccap" aria-live="off">{caption}</figcaption>
    </figure>
  );
}

function Heating({ thing, start, boil }: { thing: string; start: number; boil: number }) {
  const p = useLoop(9000, 2500);
  const x = p * 100;
  const BOIL_AT = 60;
  const temp = (t: number) => (t < BOIL_AT ? start + ((boil - start) * t) / BOIL_AT : boil);
  const T = temp(x);
  const boiling = x >= BOIL_AT;
  const toY = (v: number) => 210 - ((v - start) / (boil - start)) * 150;
  const pts: string[] = [];
  for (let i = 0; i <= x; i += 2) pts.push(`${270 + i * 3.3},${toY(temp(i))}`);
  const steam = boiling ? 1 : clamp((x - 40) / 40);
  const caption =
    x < 8
      ? "The stove is on"
      : x < BOIL_AT
        ? `The ${thing.toLowerCase()} gets hotter`
        : x < 75
          ? `It reaches ${boil} °C and boils`
          : `The heat now makes steam, so the temperature stays at ${boil} °C`;
  return (
    <Frame label={`${thing} heating on a stove. Its temperature rises to ${boil} °C, then stays flat while it boils.`} caption={caption}>
      <svg viewBox="0 0 640 250" width="100%">
        <rect x="40" y="150" width="130" height="70" rx="6" fill={boiling ? "#b5d4f4" : "#85b7eb"} />
        <path d="M30 120 L40 220 L170 220 L180 120" fill="none" stroke={MUTED} strokeWidth="3" />
        <rect x="25" y="222" width="160" height="8" rx="3" fill="#b9afa5" />
        <path d="M80 244 q10 -22 20 0 q10 -26 20 0" fill="none" stroke={WARM} strokeWidth="4" />
        {boiling &&
          [0, 1, 2, 3, 4, 5, 6].map((k) => (
            <circle key={k} cx={60 + k * 18} cy={180 + ((k * 37 + x * 6) % 35)} r={4 + (k % 3)} fill="none" stroke="#fff" strokeWidth="2" />
          ))}
        <g opacity={steam} fill="none" stroke="#b9afa5" strokeWidth="3">
          <path d="M70 110 q-8 -14 0 -26 q8 -12 0 -24" />
          <path d="M110 110 q-8 -14 0 -26 q8 -12 0 -24" />
          <path d="M150 110 q-8 -14 0 -26 q8 -12 0 -24" />
        </g>
        <line x1="270" y1="30" x2="270" y2="210" stroke={MUTED} strokeWidth="2" />
        <line x1="270" y1="210" x2="610" y2="210" stroke={MUTED} strokeWidth="2" />
        <text x="262" y="24" fontSize="13" fill={MUTED} textAnchor="end">Temperature</text>
        <text x="610" y="232" fontSize="13" fill={MUTED} textAnchor="end">Time</text>
        <line x1="270" y1={toY(boil)} x2="610" y2={toY(boil)} stroke="#cfc4b8" strokeDasharray="4 4" />
        <text x="278" y={toY(boil) - 7} fontSize="13" fill={MUTED}>{boil} °C, boiling point</text>
        <polyline fill="none" stroke={WARM} strokeWidth="4" points={pts.join(" ")} />
        <circle r="7" fill={WARM} cx={270 + x * 3.3} cy={toY(T)} />
        <text x="440" y="140" fontSize="24" fontWeight="500" fill={INK} textAnchor="middle">{Math.round(T)} °C</text>
      </svg>
    </Frame>
  );
}

function Depth({ medium }: { medium: "water" | "air" }) {
  const p = useLoop(8000, 2500);
  const d = ease(clamp(p / 0.8)); // 0 at the top, 1 at the bottom
  const top = 30;
  const bottom = 225;
  const y = top + 14 + d * (bottom - top - 28);
  const barW = 20 + d * 250;
  const fill = medium === "water" ? "#85b7eb" : "#e8dccb";
  const above = medium === "water" ? "water" : "air";
  const caption =
    d < 0.12
      ? "Near the top there is little above you"
      : d < 0.95
        ? `Going down, more ${above} is above you`
        : `Deep down, a lot of ${above} is above you, so the pressure is big`;
  return (
    <Frame label={`A gauge going down through ${above}. The pressure bar grows the deeper it goes.`} caption={caption}>
      <svg viewBox="0 0 640 250" width="100%">
        <rect x="140" y={top} width="150" height={bottom - top} fill={fill} opacity={medium === "water" ? 0.55 : 0.8} />
        {[1, 2, 3, 4, 5].map((k) => (
          <line key={k} x1="140" x2="290" y1={top + k * 32} y2={top + k * 32} stroke="#fff" strokeOpacity="0.6" />
        ))}
        <rect x="140" y={top} width="150" height={bottom - top} fill="none" stroke={MUTED} strokeWidth="2" />
        <line x1="120" x2="120" y1={top} y2={y} stroke={WARM} strokeWidth="3" />
        <text x="112" y={(top + y) / 2 + 4} fontSize="13" fill={WARM} textAnchor="end">{above} above</text>
        <circle cx="215" cy={y} r="14" fill="#fff" stroke={INK} strokeWidth="3" />
        <path d={`M215 ${y - 14} l0 -8`} stroke={INK} strokeWidth="3" />
        <text x="330" y="70" fontSize="14" fill={MUTED}>Pressure on the gauge</text>
        <rect x="330" y="82" width="270" height="26" rx="4" fill="#f0e9df" />
        <rect x="330" y="82" width={barW} height="26" rx="4" fill={WARM} />
        <text x="330" y="150" fontSize="14" fill={MUTED}>{`Depth: ${Math.round(d * 100)}%`}</text>
        <rect x="330" y="160" width="270" height="10" rx="4" fill="#f0e9df" />
        <rect x="330" y="160" width={d * 270} height="10" rx="4" fill="#8a7f75" />
      </svg>
    </Frame>
  );
}

function Expand({ thing, cold, hot }: { thing: string; cold: string; hot: string }) {
  const p = useLoop(9000, 2500);
  const e = ease(clamp((p - 0.2) / 0.5)); // 0 cold, 1 hot
  const cols = 6;
  const rows = 5;
  const dx = 30;
  const dy = 13 + e * 11;
  const boxH = rows * dy + 26;
  const baseY = 225;
  const shake = e * 3;
  const hotNow = e > 0.5;
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const j = (r * 7 + c * 3) % 5;
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={86 + c * dx + Math.sin(p * 40 + j) * shake}
          cy={baseY - 14 - r * dy + Math.cos(p * 36 + j * 2) * shake}
          r="6"
          fill={hotNow ? "#e08b6d" : "#6aa6dd"}
        />
      );
    }
  }
  const caption =
    p < 0.2
      ? `${thing} at ${cold}: the same amount fits in a small space`
      : e < 1
        ? "Heating it. The bits move more and spread out"
        : `At ${hot} the same amount takes more space, so it is less dense`;
  return (
    <Frame label={`${thing} heated from ${cold} to ${hot}. The same amount spreads out and takes more space, so its density drops.`} caption={caption}>
      <svg viewBox="0 0 640 250" width="100%">
        <path d={`M60 20 L60 ${baseY} L${86 + cols * dx - 4} ${baseY} L${86 + cols * dx - 4} 20`} fill="none" stroke={MUTED} strokeWidth="3" />
        <rect x="63" y={baseY - boxH} width={cols * dx + 20} height={boxH - 2} fill={hotNow ? "#f7d9cc" : "#dcebf8"} opacity="0.7" />
        {dots}
        <text x="330" y="80" fontSize="22" fontWeight="500" fill={INK}>{hotNow ? hot : cold}</text>
        <text x="330" y="112" fontSize="15" fill={MUTED}>Same amount of {thing.toLowerCase()}</text>
        <text x="330" y="150" fontSize="15" fill={MUTED}>Space it takes</text>
        <rect x="330" y="160" width="250" height="14" rx="4" fill="#f0e9df" />
        <rect x="330" y="160" width={150 + e * 100} height="14" rx="4" fill="#8a7f75" />
        <text x="330" y="200" fontSize="15" fill={MUTED}>Density</text>
        <rect x="330" y="210" width="250" height="14" rx="4" fill="#f0e9df" />
        <rect x="330" y="210" width={250 - e * 100} height="14" rx="4" fill={WARM} />
      </svg>
    </Frame>
  );
}

function Cube({ faces }: { faces: [string, string, string, string, string, string] }) {
  const p = useLoop(12000, 1500);
  const pair = Math.min(2, Math.floor(p * 3));
  const placed = [
    "translateZ(60px)",
    "rotateY(180deg) translateZ(60px)",
    "rotateY(90deg) translateZ(60px)",
    "rotateY(-90deg) translateZ(60px)",
    "rotateX(90deg) translateZ(60px)",
    "rotateX(-90deg) translateZ(60px)",
  ];
  const a = faces[pair * 2];
  const b = faces[pair * 2 + 1];
  return (
    <Frame
      label={`A turning cube. ${faces[0]} is opposite ${faces[1]}, ${faces[2]} is opposite ${faces[3]}, and ${faces[4]} is opposite ${faces[5]}.`}
      caption={`${a} and ${b} are on opposite sides, so you can never see them together`}
    >
      <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", perspective: 600 }}>
        <div
          style={{
            width: 120,
            height: 120,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `rotateX(${-28 + Math.sin(p * Math.PI * 2) * 30}deg) rotateY(${p * 360}deg)`,
          }}
        >
          {faces.map((f, i) => {
            const lit = Math.floor(i / 2) === pair;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: placed[i],
                  backfaceVisibility: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  fontWeight: 500,
                  color: lit ? "#fff" : INK,
                  background: lit ? WARM : "#fffdf9",
                  border: "2px solid var(--ink)",
                  borderRadius: 8,
                }}
              >
                {f}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

export default function LessonPicture({ picture }: { picture: Picture }) {
  if (picture.template === "heating") return <Heating thing={picture.thing} start={picture.start} boil={picture.boil} />;
  if (picture.template === "depth") return <Depth medium={picture.medium} />;
  if (picture.template === "expand") return <Expand thing={picture.thing} cold={picture.cold} hot={picture.hot} />;
  return <Cube faces={picture.faces} />;
}
