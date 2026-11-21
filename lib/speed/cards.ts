// Speed: shortcut cards and the question makers behind them (Class 8, NCERT, medium to slightly beyond).
// Every card has a `make` that builds a question AND works it out two ways: the ordinary way (direct) and by
// following the card's own steps (short). `npm run check:speed` runs each card thousands of times and fails if the
// two ever differ, so the app never teaches a shortcut that gives a wrong answer. No AI is used anywhere in here.
// This file imports nothing so that the check script can run it on its own.

// ---------- exact fractions ----------

export type Rat = [number, number];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export function rat(n: number, d = 1): Rat {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return [n / g, d / g];
}
const mul = (a: Rat, b: Rat) => rat(a[0] * b[0], a[1] * b[1]);
const add = (a: Rat, b: Rat) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a: Rat, b: Rat) => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const same = (a: Rat, b: Rat) => a[0] === b[0] && a[1] === b[1];

// A whole number or a short decimal as digits ("12", "0.75"); anything that does not end as a decimal stays a fraction.
export function fmt(r: Rat): string {
  const [n, d] = r;
  if (d === 1) return String(n);
  let x = d;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  if (x !== 1) return `${n}/${d}`;
  return String(Number((n / d).toFixed(6)));
}
// Probabilities are always shown as fractions.
export function fmtFrac(r: Rat): string {
  return r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`;
}

// What the student typed -> a fraction, or null if it is not a number. Accepts 12, 0.75, 3/4, -2, "₹ 1,200", "25%".
export function parseAnswer(raw: string): Rat | null {
  const s = raw.replace(/[₹%,\s]/g, "").replace(/^\+/, "");
  if (!s) return null;
  const one = (t: string): Rat | null => {
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    const [whole, frac = ""] = t.replace(/^-/, "").split(".");
    if (frac.length > 6) return null;
    const scale = 10 ** frac.length;
    const n = Number(whole || "0") * scale + Number(frac || "0");
    return rat(t.startsWith("-") ? -n : n, scale);
  };
  const parts = s.split("/");
  if (parts.length === 1) return one(s);
  if (parts.length === 2) {
    const a = one(parts[0]);
    const b = one(parts[1]);
    if (!a || !b || b[0] === 0) return null;
    return rat(a[0] * b[1], a[1] * b[0]);
  }
  return null;
}

// ---------- random numbers (seeded, so a run can be checked again) ----------

export type Rnd = () => number;
export function seeded(seed: number): Rnd {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r: Rnd, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rnd, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ---------- cards ----------

export type TopicId =
  | "percentages" | "ratio" | "multiplication" | "division" | "profit-loss" | "probability"
  | "motion" | "pressure" | "sound" | "light" | "electricity";
// Eight steps. Steps 1 to 3 are the original three levels; 4 to 8 are harder (bigger numbers, more steps, new twists).
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const MAX_STEP = 8;
// How much bigger the numbers get: 1 up to step 3, then 2, 3, 4, 5, 6 for steps 4 to 8.
const M = (l: Level) => (l <= 3 ? 1 : l - 2);
export type Made = { q: string; a: string; how: string; direct: Rat; short: Rat };
export type Card = {
  id: string;
  topic: TopicId;
  title: string;
  when: string;
  steps: string[];
  make: (level: Level, r: Rnd) => Made;
};

export type Subject = "Maths" | "Physics";
export const TOPICS: { id: TopicId; label: string; line: string; targetMs: number; subject: Subject }[] = [
  { id: "percentages", label: "Percentages", line: "Find a percent of a number without long working.", targetMs: 30_000, subject: "Maths" },
  { id: "ratio", label: "Ratio and proportion", line: "Share amounts, scale up and down, and work with direct and inverse change.", targetMs: 40_000, subject: "Maths" },
  { id: "multiplication", label: "Multiplication", line: "Squares, times 11, numbers near 100 and round-number tricks.", targetMs: 25_000, subject: "Maths" },
  { id: "division", label: "Division", line: "Divide by 5, 25, 125 and by breaking the divisor.", targetMs: 25_000, subject: "Maths" },
  { id: "profit-loss", label: "Profit and loss", line: "Selling price and cost price with percent changes.", targetMs: 40_000, subject: "Maths" },
  { id: "probability", label: "Probability", line: "Dice, bags of balls, and counting outcomes quickly.", targetMs: 30_000, subject: "Maths" },
  { id: "motion", label: "Speed and motion", line: "Speed, distance and time, km/h and m/s, average speed and meeting.", targetMs: 40_000, subject: "Physics" },
  { id: "pressure", label: "Pressure", line: "Force over area, pressure under water, and what changes it.", targetMs: 40_000, subject: "Physics" },
  { id: "sound", label: "Sound", line: "Frequency, echoes and wavelength.", targetMs: 35_000, subject: "Physics" },
  { id: "light", label: "Light: mirrors and lenses", line: "Reflection angles, plane mirrors, focal length and lens power.", targetMs: 35_000, subject: "Physics" },
  { id: "electricity", label: "Electricity", line: "Current, resistance, power, units of electricity and heating.", targetMs: 45_000, subject: "Physics" },
];

const dieSet = [1, 2, 3, 4, 5, 6];
const isPrime = (x: number) => x > 1 && Array.from({ length: x - 2 }, (_, i) => i + 2).every((d) => x % d !== 0);
const twoDice: [number, number][] = dieSet.flatMap((a) => dieSet.map((b) => [a, b] as [number, number]));
const countDie = (f: (x: number) => boolean) => dieSet.filter(f).length;
const countTwo = (f: (a: number, b: number) => boolean) => twoDice.filter(([a, b]) => f(a, b)).length;
const nCk = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : Math.round((nCk(n - 1, k - 1) * n) / k));
const headsCount = (bits: number) => bits.toString(2).split("1").length - 1;
const countCoins = (n: number, f: (bits: number) => boolean) => Array.from({ length: 2 ** n }, (_, b) => b).filter(f).length;
const countThree = (f: (a: number, b: number, c: number) => boolean) => {
  let c = 0;
  for (const a of dieSet) for (const b of dieSet) for (const d of dieSet) if (f(a, b, d)) c++;
  return c;
};
const bagBalls = (r: Rnd) => {
  const red = ri(r, 3, 9);
  const blue = ri(r, 2, 8);
  return { red, blue, total: red + blue };
};

// ---------- physics question helpers ----------
const div = (a: Rat, b: Rat) => mul(a, rat(b[1], b[0]));
const abs = (a: Rat): Rat => rat(Math.abs(a[0]), a[1]);
const RETRY = new Error("try other numbers");
type PQ = { q: string; direct: Rat; short: Rat; how: string };
export const PHYS_STATS = { fallbacks: 0 };
// A physics answer must be a short decimal (at most 4 places), positive, and the question must not print a fraction like 7/3.
function niceAnswer(x: Rat, q: string): boolean {
  const t = fmt(x);
  if (t.includes("/")) return false;
  if ((t.split(".")[1]?.length ?? 0) > 4) return false;
  if (x[0] <= 0 || x[0] / x[1] > 1e9) return false;
  return !/\d\/\d/.test(q);
}
function phys(r: Rnd, gen: () => PQ): Made {
  for (let i = 0; i < 80; i++) {
    try {
      const m = gen();
      if (niceAnswer(m.direct, m.q)) return { ...m, a: fmt(m.direct) };
    } catch (e) {
      if (e !== RETRY) throw e;
    }
  }
  PHYS_STATS.fallbacks++;
  return { q: "A car travels 120 m in 6 s. What is its speed? (in m/s)", a: "20", direct: rat(20), short: rat(20), how: "Speed = 120 ÷ 6 = 20 m/s." };
}

export const CARDS: Card[] = [
  // ---------- percentages ----------
  {
    id: "pc-blocks",
    topic: "percentages",
    title: "Build it from 10% and 5%",
    when: "The percent ends in 0 or 5: 15%, 35%, 45%, 70%.",
    steps: ["Find 10%: move the point one place left.", "Find 5%: halve the 10%.", "Add the pieces. 35% is 10% + 10% + 10% + 5%."],
    make(level, r) {
      const ps = level === 1 ? [15, 25, 35, 45] : level === 2 ? [15, 35, 45, 55, 65, 85, 95] : [15, 25, 35, 45, 55, 65, 75, 85, 95, 20, 30, 40, 60, 70, 80, 90];
      const p = pick(r, ps);
      const n = 20 * (level === 1 ? ri(r, 2, 15) : level === 2 ? ri(r, 10, 40) : ri(r, 25 * M(level), 90 * M(level)));
      const ten = n / 10;
      const five = ten / 2;
      const t = Math.floor(p / 10);
      const has5 = p % 10 === 5;
      const short = rat(t * ten + (has5 ? five : 0));
      const direct = rat(n * p, 100);
      const terms = [t > 0 ? (t === 1 ? `${ten}` : `${t} × ${ten}`) : "", has5 ? `${five}` : ""].filter(Boolean).join(" + ");
      return { q: `${p}% of ${n}`, a: fmt(direct), direct, short, how: `10% of ${n} is ${ten}${has5 ? `, and 5% is ${five}` : ""}. So ${p}% = ${terms} = ${fmt(direct)}.` };
    },
  },
  {
    id: "pc-flip",
    topic: "percentages",
    title: "Flip the percent",
    when: "A small percent of a friendly number, like 16% of 50 or 24% of 75.",
    steps: ["a% of b is always the same as b% of a.", "Flip it so the percent is the easy one (50%, 25%, 75%, 10%, 20%).", "Work that out instead."],
    make(level, r) {
      const b = pick(r, level === 1 ? [10, 20, 25, 50] : [10, 20, 25, 50, 75]);
      const a = 4 * (level === 1 ? ri(r, 1, 5) : level === 2 ? ri(r, 3, 12) : ri(r, 8 * M(level), 25 * M(level)));
      const direct = rat(a * b, 100);
      const short = mul(rat(b, 100), rat(a));
      const how =
        b === 25 ? `a quarter of ${a}` : b === 50 ? `half of ${a}` : b === 75 ? `three quarters of ${a}` : b === 10 ? `${a} ÷ 10` : `${a} ÷ 5`;
      return { q: `${a}% of ${b}`, a: fmt(direct), direct, short, how: `${a}% of ${b} is the same as ${b}% of ${a}, which is ${how} = ${fmt(direct)}.` };
    },
  },
  {
    id: "pc-fractions",
    topic: "percentages",
    title: "Fraction friends",
    when: "The percent is a fraction you can learn once: 12.5%, 37.5%, 33⅓%, 16⅔%, 6.25%.",
    steps: [
      "Learn the list: 12.5% = 1/8, 37.5% = 3/8, 62.5% = 5/8, 87.5% = 7/8, 33⅓% = 1/3, 66⅔% = 2/3, 16⅔% = 1/6, 6.25% = 1/16.",
      "Divide the number by the bottom.",
      "Multiply by the top.",
    ],
    make(level, r) {
      const all: [string, Rat, number, number][] = [
        ["12.5%", [25, 2], 1, 8],
        ["37.5%", [75, 2], 3, 8],
        ["62.5%", [125, 2], 5, 8],
        ["87.5%", [175, 2], 7, 8],
        ["33⅓%", [100, 3], 1, 3],
        ["66⅔%", [200, 3], 2, 3],
        ["16⅔%", [50, 3], 1, 6],
        ["6.25%", [25, 4], 1, 16],
      ];
      const pool = level === 1 ? [all[0], all[4], all[5]] : level === 2 ? [all[0], all[1], all[2], all[4], all[5], all[6]] : all;
      const [label, pct, num, den] = pick(r, pool);
      const n = den * (level === 1 ? ri(r, 2, 12) : level === 2 ? ri(r, 3, 25) : ri(r, 5 * M(level), 60 * M(level)));
      const direct = mul(rat(n), mul(pct, rat(1, 100)));
      const short = rat((n / den) * num);
      return { q: `${label} of ${n}`, a: fmt(direct), direct, short, how: `${label} is ${num}/${den}. ${n} ÷ ${den} = ${n / den}${num > 1 ? `, × ${num} = ${fmt(direct)}` : ""}.` };
    },
  },
  {
    id: "pc-successive",
    topic: "percentages",
    title: "Two changes in a row",
    when: "A price changes twice, or two discounts follow each other.",
    steps: ["Add the two percents (a fall counts as minus).", "Add (first × second ÷ 100), again with the signs.", "That single percent replaces both changes."],
    make(level, r) {
      if (level >= 5 && r() < 0.5) {
        const v5 = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];
        const a = pick(r, v5);
        const b = pick(r, v5);
        const up2 = r() < 0.5;
        const sb = up2 ? b : -b;
        const CP = 400 * ri(r, 1, 10 * M(level));
        const direct = rat(CP * (100 + a) * (100 + sb), 10000);
        const pct = rat(100 * (a + sb) + a * sb, 100);
        const short = mul(rat(CP), add(rat(1), mul(pct, rat(1, 100))));
        return {
          q: `A price of ${money(CP)} rises by ${a}% and then ${up2 ? "rises" : "falls"} by ${b}%. What is the final price? (in ₹)`,
          a: fmt(direct),
          direct,
          short,
          how: `One single change: ${a} ${up2 ? "+" : "−"} ${b} ${up2 ? "+" : "−"} (${a} × ${b} ÷ 100) = ${fmt(pct)}%. ${money(CP)} changed by ${fmt(pct)}% is ${fmt(direct)}.`,
        };
      }
      const vals = level === 1 ? [10, 20, 25, 30] : level === 2 ? [5, 10, 15, 20, 25, 30, 40] : [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];
      for (let tries = 0; tries < 30; tries++) {
        const a = pick(r, vals);
        const b = pick(r, vals);
        const kind = ri(r, 0, 2);
        const sa = kind === 1 ? -a : a;
        const sb = kind === 0 ? b : -b;
        const direct = rat((100 + sa) * (100 + sb) - 10000, 100);
        if (direct[0] <= 0 && kind !== 1) continue;
        const short = rat(100 * (sa + sb) + sa * sb, 100);
        const ab = fmt(rat(a * b, 100));
        if (kind === 1) {
          const ans = mul(direct, rat(-1));
          const s = mul(short, rat(-1));
          return { q: `Two discounts, ${a}% and then ${b}%, are given one after the other. What single discount is the same? (in %)`, a: fmt(ans), direct: ans, short: s, how: `${a} + ${b} − (${a} × ${b} ÷ 100) = ${a + b} − ${ab} = ${fmt(ans)}%.` };
        }
        if (kind === 0) return { q: `A price rises by ${a}%, then rises by ${b}% more. By what percent is the final price above the start?`, a: fmt(direct), direct, short, how: `${a} + ${b} + (${a} × ${b} ÷ 100) = ${a + b} + ${ab} = ${fmt(direct)}%.` };
        return { q: `A price rises by ${a}% and then falls by ${b}%. By what percent is the final price above the start?`, a: fmt(direct), direct, short, how: `${a} − ${b} − (${a} × ${b} ÷ 100) = ${a - b} − ${ab} = ${fmt(direct)}%.` };
      }
      const direct = rat(1700, 100);
      return { q: "A price rises by 30% and then falls by 10%. By what percent is the final price above the start?", a: "17", direct, short: direct, how: "30 − 10 − (30 × 10 ÷ 100) = 20 − 3 = 17%." };
    },
  },

  // ---------- ratio and proportion ----------
  {
    id: "ra-parts",
    topic: "ratio",
    title: "Count the parts",
    when: "An amount is shared in a ratio, or one share is known.",
    steps: ["Add the ratio numbers: that is the total number of parts.", "Divide the amount by that: one part.", "Multiply one part by the share you want."],
    make(level, r) {
      if (level === 1) {
        const a = ri(r, 1, 9);
        let b = ri(r, 1, 9);
        if (b === a) b = a === 9 ? 8 : a + 1;
        const u = 5 * ri(r, 2, 20);
        const T = u * (a + b);
        const direct = rat(T * b, a + b);
        const short = mul(rat(T, a + b), rat(b));
        return { q: `Share ${money(T)} in the ratio ${a} : ${b}. How much is the ${b}-part? (in ₹)`, a: fmt(direct), direct, short, how: `${a} + ${b} = ${a + b} parts. ${T} ÷ ${a + b} = ${u} for one part. ${u} × ${b} = ${fmt(direct)}.` };
      }
      if (level === 2) {
        const a = ri(r, 2, 8);
        const b = a + ri(r, 1, 6);
        const u = ri(r, 4, 40);
        const S = a * u;
        const direct = rat(S * (a + b), a);
        const short = mul(rat(S, a), rat(a + b));
        return { q: `Two numbers are in the ratio ${a} : ${b}. The smaller one is ${S}. What is their sum?`, a: fmt(direct), direct, short, how: `${a} parts is ${S}, so one part is ${S} ÷ ${a} = ${u}. Total parts ${a + b}, so ${u} × ${a + b} = ${fmt(direct)}.` };
      }
      const people = level >= 6 ? 4 : 3;
      const cap = 9 + 2 * Math.max(0, level - 3);
      const xs = Array.from({ length: people }, () => ri(r, 1, cap));
      if (new Set(xs).size < 2) xs[1] = (xs[0] % cap) + 1;
      const sum = xs.reduce((a, b) => a + b, 0);
      const u = 5 * ri(r, 2, 24 * M(level));
      const T = u * sum;
      const hi = Math.max(...xs);
      const lo = Math.min(...xs);
      const direct = rat(T * (hi - lo), sum);
      const short = mul(rat(T, sum), rat(hi - lo));
      return { q: `${money(T)} is shared among ${people === 3 ? "three" : "four"} people in the ratio ${xs.join(" : ")}. How much more does the largest share get than the smallest? (in ₹)`, a: fmt(direct), direct, short, how: `${xs.join(" + ")} = ${sum} parts. ${T} ÷ ${sum} = ${u} a part. Largest minus smallest is ${hi} − ${lo} = ${hi - lo} parts, so ${u} × ${hi - lo} = ${fmt(direct)}.` };
    },
  },
  {
    id: "ra-scale",
    topic: "ratio",
    title: "Find the scale factor",
    when: "Equal ratios: recipes, maps, “a : b = c : ?”.",
    steps: ["See what the first number was multiplied (or divided) by to reach the third.", "Do the same to the second number."],
    make(level, r) {
      let p = 0;
      let q = 0;
      do {
        p = ri(r, 1, level === 1 ? 5 : 9 + 2 * Math.max(0, level - 3));
        q = ri(r, 1, level === 1 ? 5 : 9 + 2 * Math.max(0, level - 3));
      } while (p === q || gcd(p, q) !== 1);
      const g = level === 1 ? ri(r, 2, 6) : level === 2 ? ri(r, 2, 9) : ri(r, 3, 14 * M(level));
      const h = level === 1 ? ri(r, 2, 9) : level === 2 ? ri(r, 2, 15) : ri(r, 3, 25 * M(level));
      const [a, b, c] = [g * p, g * q, h * p];
      const direct = rat(b * c, a);
      const short = mul(rat(c, a), rat(b));
      return { q: `${a} : ${b} = ${c} : ?`, a: fmt(direct), direct, short, how: `${a} became ${c}, which is × ${fmt(rat(c, a))}. So ${b} × ${fmt(rat(c, a))} = ${fmt(direct)}.` };
    },
  },
  {
    id: "ra-inverse",
    topic: "ratio",
    title: "Keep the product fixed",
    when: "More workers means fewer days; more people means the food lasts fewer days.",
    steps: ["Multiply the two numbers you know: that is the total work.", "Divide the total work by the new number."],
    make(level, r) {
      const Ts = level >= 4 ? [24, 36, 48, 60, 72, 90, 120, 180, 240, 360, 480, 720, 840, 1080, 1440] : [24, 36, 48, 60, 72, 90, 120, 180, 240, 360];
      for (let tries = 0; tries < 60; tries++) {
        const T = pick(r, level === 1 ? Ts.slice(0, 5) : Ts);
        const divs = Array.from({ length: T }, (_, i) => i + 1).filter((x) => T % x === 0 && x >= 2 && x <= (level >= 4 ? 60 : 40));
        const m = pick(r, divs);
        const n = pick(r, divs);
        const d = T / m;
        if (m === n || d < 2) continue;
        const direct = rat(m * d, n);
        const short = rat(T, n);
        const kind = level === 1 ? 0 : ri(r, 0, 2);
        const q =
          kind === 0
            ? `${m} workers finish a job in ${d} days. How many days will ${n} workers take at the same pace?`
            : kind === 1
              ? `A camp has food for ${m} people for ${d} days. For how many days will the same food last ${n} people?`
              : `${m} pipes fill a tank in ${d} hours. How many hours will ${n} identical pipes take?`;
        return { q, a: fmt(direct), direct, short, how: `${m} × ${d} = ${T} in total. ${T} ÷ ${n} = ${fmt(direct)}.` };
      }
      return { q: "6 workers finish a job in 12 days. How many days will 9 workers take at the same pace?", a: "8", direct: rat(8), short: rat(8), how: "6 × 12 = 72 in total. 72 ÷ 9 = 8." };
    },
  },

  // ---------- multiplication ----------
  {
    id: "mu-11",
    topic: "multiplication",
    title: "Times 11: add the neighbours",
    when: "Multiplying by 11.",
    steps: ["Keep the first and last digits at the ends.", "Between them, put the sum of each pair of neighbouring digits.", "If a sum is 10 or more, carry the 1 to the digit on its left."],
    make(level, r) {
      let n: number;
      if (level <= 3) n = level === 1 ? ri(r, 12, 99) : level === 2 ? ri(r, 100, 999) : ri(r, 1000, 9999);
      else {
        const k = Math.min(7, level + 1);
        if (level >= 7) n = Number(Array.from({ length: k }, () => ri(r, 5, 9)).join(""));
        else n = ri(r, 10 ** (k - 1), 10 ** k - 1);
      }
      const d = String(n).split("").map(Number);
      const k = d.length;
      const s = [d[0], ...d.slice(1).map((x, i) => d[i] + x), d[k - 1]];
      const short = rat(s.reduce((acc, v, j) => acc + v * 10 ** (k - j), 0));
      const direct = rat(n * 11);
      const parts = s.map((v, j) => (j === 0 || j === k ? `${v}` : `${d[j - 1]}+${d[j]}=${v}`)).join(", ");
      return { q: `${n} × 11`, a: fmt(direct), direct, short, how: `Digits from the left: ${parts}. Carry any tens: ${fmt(direct)}.` };
    },
  },
  {
    id: "mu-square5",
    topic: "multiplication",
    title: "Squares ending in 5",
    when: "A number that ends in 5, squared.",
    steps: ["Take the digits before the 5 (for 35, that is 3).", "Multiply that by the next number up (3 × 4 = 12).", "Write 25 after it: 1225."],
    make(level, r) {
      if (level >= 7 && r() < 0.5) {
        const w = ri(r, 1, 9 * M(level));
        const direct = add(rat(w * (w + 1)), rat(1, 4));
        return { q: `${w}.5²`, a: fmt(direct), direct, short: rat(w * w * 4 + w * 4 + 1, 4), how: `${w} × ${w + 1} = ${w * (w + 1)}, then .25 after it: ${fmt(direct)}.` };
      }
      const n = level === 1 ? ri(r, 1, 9) : level === 2 ? ri(r, 10, 19) : level === 3 ? ri(r, 20, 99) : level === 4 ? ri(r, 100, 199) : level === 5 ? ri(r, 100, 999) : ri(r, 1000, 4999);
      const x = 10 * n + 5;
      const direct = rat(x * x);
      const short = rat(n * (n + 1) * 100 + 25);
      return { q: `${x}²`, a: fmt(direct), direct, short, how: `${n} × ${n + 1} = ${n * (n + 1)}, then 25 after it: ${fmt(direct)}.` };
    },
  },
  {
    id: "mu-near100",
    topic: "multiplication",
    title: "Numbers near 100",
    when: "Both numbers are close to 100, above or below.",
    steps: ["Find how far each is from 100 (below is minus).", "Front part: 100 plus both gaps.", "Back part: multiply the two gaps.", "Front × 100, then add the back part."],
    make(level, r) {
      const base = level >= 6 ? 1000 : 100;
      const gap = () => (level === 1 ? -ri(r, 1, 9) : level === 2 ? -ri(r, 1, 20) : pick(r, [-1, 1]) * ri(r, 1, 15 + 5 * Math.max(0, level - 3)));
      const d1 = gap();
      const d2 = gap();
      const [a, b] = [base + d1, base + d2];
      const front = base + d1 + d2;
      const back = d1 * d2;
      const direct = rat(a * b);
      const short = rat(front * base + back);
      const sg = (x: number) => (x < 0 ? `−${-x}` : `+${x}`);
      return { q: `${a} × ${b}`, a: fmt(direct), direct, short, how: `Gaps from ${base}: ${sg(d1)} and ${sg(d2)}. Front: ${base} ${sg(d1)} ${sg(d2)} = ${front}. Back: ${d1} × ${d2} = ${back}. ${front * base} ${back < 0 ? "−" : "+"} ${Math.abs(back)} = ${fmt(direct)}.` };
    },
  },
  {
    id: "mu-mid",
    topic: "multiplication",
    title: "Straddle a round number",
    when: "The two numbers sit the same distance either side of a round number, like 47 × 53.",
    steps: ["Find the middle number (47 and 53 are both 3 away from 50).", "Square the middle (50² = 2500).", "Subtract the square of the distance (3² = 9). 2500 − 9 = 2491."],
    make(level, r) {
      const m = level === 1 ? pick(r, [20, 30, 40, 50, 60]) : level === 2 ? 5 * ri(r, 5, 19) : 10 * ri(r, 10, 20 * M(level));
      const d = level === 1 ? ri(r, 1, 5) : level === 2 ? ri(r, 1, 9) : ri(r, 1, 15 + 8 * (M(level) - 1));
      const direct = rat((m - d) * (m + d));
      const short = rat(m * m - d * d);
      return { q: `${m - d} × ${m + d}`, a: fmt(direct), direct, short, how: `Both are ${d} away from ${m}. ${m}² − ${d}² = ${m * m} − ${d * d} = ${fmt(direct)}.` };
    },
  },
  {
    id: "mu-factors",
    topic: "multiplication",
    title: "Times 5, 25, 50 or 125",
    when: "One of the numbers is 5, 25, 50 or 125.",
    steps: ["× 5: multiply by 10, then halve.", "× 25: multiply by 100, then ÷ 4.", "× 50: multiply by 100, then halve.", "× 125: multiply by 1000, then ÷ 8."],
    make(level, r) {
      const all: [number, number, number][] = [[5, 10, 2], [25, 100, 4], [50, 100, 2], [125, 1000, 8], [250, 1000, 4]];
      const [m, K, D] = pick(r, level === 1 ? [all[0], all[2]] : level === 2 ? [all[0], all[1], all[2]] : level <= 4 ? [all[1], all[3], all[2]] : [all[1], all[3], all[2], all[4]]);
      const n = level === 1 ? ri(r, 12, 98) : level === 2 ? ri(r, 24, 350) : ri(r, 36, 999 * M(level));
      const direct = rat(n * m);
      const short = rat((n * K) / D);
      return { q: `${n} × ${m}`, a: fmt(direct), direct, short, how: `${n} × ${K} = ${n * K}, then ÷ ${D} = ${fmt(direct)}.` };
    },
  },

  // ---------- division ----------
  {
    id: "di-multiply",
    topic: "division",
    title: "Divide by multiplying",
    when: "Dividing by 5, 25, 50 or 125.",
    steps: ["÷ 5: multiply by 2, then move the point one place left.", "÷ 25: multiply by 4, then move the point two places left.", "÷ 50: multiply by 2, then two places left.", "÷ 125: multiply by 8, then three places left."],
    make(level, r) {
      const all: [number, number, number][] = [[5, 2, 10], [25, 4, 100], [50, 2, 100], [125, 8, 1000], [250, 4, 1000]];
      const [m, K, D] = pick(r, level === 1 ? [all[0], all[2]] : level === 2 ? [all[0], all[1], all[2]] : level <= 4 ? [all[1], all[3]] : [all[1], all[3], all[4]]);
      const n = level === 1 ? ri(r, 20, 199) : level === 2 ? ri(r, 30, 899) : ri(r, 100, 9999 * M(level));
      const direct = rat(n, m);
      const short = rat(n * K, D);
      return { q: `${n} ÷ ${m}`, a: fmt(direct), direct, short, how: `${n} × ${K} = ${n * K}, and moving the point ${String(D).length - 1} ${D === 10 ? "place" : "places"} left gives ${fmt(direct)}.` };
    },
  },
  {
    id: "di-break",
    topic: "division",
    title: "Break the divisor",
    when: "The divisor is a product you know: 6, 12, 15, 18, 24, 45.",
    steps: ["Split the divisor into two smaller numbers (12 = 3 × 4).", "Divide by the first, then by the second."],
    make(level, r) {
      const all: [number, number, number][] = [[6, 2, 3], [12, 3, 4], [15, 3, 5], [14, 2, 7], [18, 2, 9], [24, 4, 6], [45, 5, 9], [36, 6, 6], [28, 4, 7], [54, 6, 9], [63, 7, 9], [72, 8, 9], [84, 12, 7], [96, 12, 8], [132, 11, 12]];
      const [m, a, b] = pick(r, level === 1 ? all.slice(0, 3) : level === 2 ? all.slice(0, 6) : all);
      const n = m * (level === 1 ? ri(r, 3, 15) : level === 2 ? ri(r, 5, 35) : ri(r, 8, 60 * M(level)));
      const direct = rat(n, m);
      const short = rat(n / a, b);
      return { q: `${n} ÷ ${m}`, a: fmt(direct), direct, short, how: `${m} = ${a} × ${b}. ${n} ÷ ${a} = ${n / a}, then ÷ ${b} = ${fmt(direct)}.` };
    },
  },

  // ---------- profit and loss ----------
  {
    id: "pl-multiplier",
    topic: "profit-loss",
    title: "Turn the percent into a fraction",
    when: "Find the selling price from the cost and a profit, loss or discount percent.",
    steps: ["Write the percent as a simple fraction: 20% = 1/5.", "Cost ÷ bottom gives one part.", "Profit: multiply by (bottom + top). Loss or discount: multiply by (bottom − top)."],
    make(level, r) {
      const ps = level === 1 ? [10, 20, 25, 50] : level >= 4 ? [4, 6, 8, 12, 15, 16, 24, 32, 35, 36, 44, 45, 48, 60] : [5, 10, 15, 20, 25, 30, 35, 40, 50, 60];
      const p = pick(r, ps);
      const CP = level >= 4 ? 100 * ri(r, 3 * M(level), 40 * M(level)) : 20 * (level === 1 ? ri(r, 3, 30) : level === 2 ? ri(r, 5, 60) : ri(r, 10, 120));
      const kind = level === 1 ? ri(r, 0, 1) : ri(r, 0, 2);
      const sign = kind === 0 ? 1 : -1;
      const g = gcd(p, 100);
      const n = p / g;
      const d = 100 / g;
      const direct = rat(CP * (100 + sign * p), 100);
      const short = rat((CP / d) * (d + sign * n));
      const q =
        kind === 0
          ? `An item costs ${money(CP)}. It is sold at a profit of ${p}%. What is the selling price? (in ₹)`
          : kind === 1
            ? `An item costs ${money(CP)}. It is sold at a loss of ${p}%. What is the selling price? (in ₹)`
            : `An item is marked ${money(CP)}. A discount of ${p}% is given. What is the selling price? (in ₹)`;
      return { q, a: fmt(direct), direct, short, how: `${p}% = ${n}/${d}. ${CP} ÷ ${d} = ${CP / d}. × (${d} ${sign > 0 ? "+" : "−"} ${n}) = ${CP / d} × ${d + sign * n} = ${fmt(direct)}.` };
    },
  },
  {
    id: "pl-reverse",
    topic: "profit-loss",
    title: "Work backwards in parts",
    when: "Find the cost price when you know the selling price and the percent.",
    steps: ["Write the percent as a fraction n/d. The cost is always d parts.", "Profit: the selling price is (d + n) parts. Loss: it is (d − n) parts.", "Selling price ÷ its parts = one part. One part × d = cost."],
    make(level, r) {
      const ps = level === 1 ? [10, 20, 25, 50] : level >= 4 ? [4, 6, 8, 12, 15, 16, 24, 32, 36, 45, 48] : [5, 10, 15, 20, 25, 30, 40, 50];
      const p = pick(r, ps);
      const g = gcd(p, 100);
      const n = p / g;
      const d = 100 / g;
      const profit = ri(r, 0, 1) === 0;
      const k = level === 1 ? ri(r, 2, 12) : level === 2 ? ri(r, 3, 30) : ri(r, 5, 80 * M(level));
      const CP = d * k;
      const parts = profit ? d + n : d - n;
      const SP = k * parts;
      const direct = rat(SP * 100, 100 + (profit ? p : -p));
      const short = rat((SP / parts) * d);
      return { q: `An item is sold for ${money(SP)} at a ${p}% ${profit ? "profit" : "loss"}. What was its cost price? (in ₹)`, a: fmt(direct), direct, short, how: `${p}% = ${n}/${d}. ${profit ? "Profit" : "Loss"}: selling price is ${parts} parts, cost is ${d} parts. ${SP} ÷ ${parts} = ${k}, × ${d} = ${CP}.` };
    },
  },

  // ---------- probability ----------
  {
    id: "pr-count",
    topic: "probability",
    title: "Count the wanted over all",
    when: "One die, a bag of balls, or two dice.",
    steps: ["Count every equally likely outcome: the bottom.", "Count the outcomes you want: the top.", "Write top over bottom and cancel."],
    make(level, r) {
      if (level >= 4) {
        const kind = pick(r, [0, 1, 2, 3, 4].slice(0, Math.min(5, level - 3)));
        if (kind === 0) {
          const evs: [string, (a: number, b: number) => boolean][] = [
            ["the product is even", (a, b) => (a * b) % 2 === 0],
            ["the product is more than 12", (a, b) => a * b > 12],
            ["the two numbers differ by 2", (a, b) => Math.abs(a - b) === 2],
            ["both numbers are the same", (a, b) => a === b],
            ["the larger number is 4", (a, b) => Math.max(a, b) === 4],
            ["the sum is a prime number", (a, b) => isPrime(a + b)],
            ["the sum is a multiple of 4", (a, b) => (a + b) % 4 === 0],
            ["the first number is bigger than the second", (a, b) => a > b],
          ];
          const [name, f] = pick(r, evs);
          const direct = rat(countTwo(f), 36);
          const short = rat(dieSet.reduce((acc, a) => acc + dieSet.filter((b) => f(a, b)).length, 0), 36);
          return { q: `Two fair dice are rolled. What is the probability that ${name}?`, a: fmtFrac(direct), direct, short, how: `Count the pairs that work in the 6 × 6 table: ${countTwo(f)} of 36. ${countTwo(f)}/36 = ${fmtFrac(direct)}.` };
        }
        if (kind === 1 || kind === 2) {
          const { red, blue, total } = bagBalls(r);
          if (kind === 1) {
            const direct = rat(red * (red - 1), total * (total - 1));
            const short = rat(nCk(red, 2), nCk(total, 2));
            return { q: `A bag has ${red} red and ${blue} blue balls. Two balls are picked one after the other without putting the first back. What is the probability that both are red?`, a: fmtFrac(direct), direct, short, how: `Pairs of red: ${nCk(red, 2)}. All pairs: ${nCk(total, 2)}. ${nCk(red, 2)}/${nCk(total, 2)} = ${fmtFrac(direct)}.` };
          }
          const direct = rat(2 * red * blue, total * (total - 1));
          const short = rat(red * blue, nCk(total, 2));
          return { q: `A bag has ${red} red and ${blue} blue balls. Two balls are picked together. What is the probability that one is red and one is blue?`, a: fmtFrac(direct), direct, short, how: `Red-blue pairs: ${red} × ${blue} = ${red * blue}. All pairs: ${nCk(total, 2)}. ${red * blue}/${nCk(total, 2)} = ${fmtFrac(direct)}.` };
        }
        if (kind === 3) {
          const n = pick(r, [3, 4]);
          const k = ri(r, 1, n - 1);
          const direct = rat(countCoins(n, (b) => headsCount(b) === k), 2 ** n);
          const short = rat(nCk(n, k), 2 ** n);
          return { q: `${n} fair coins are tossed together. What is the probability of exactly ${k} ${k === 1 ? "head" : "heads"}?`, a: fmtFrac(direct), direct, short, how: `Ways to choose which ${k} coin${k === 1 ? "" : "s"} show heads: ${nCk(n, k)}. All outcomes: 2^${n} = ${2 ** n}. ${nCk(n, k)}/${2 ** n} = ${fmtFrac(direct)}.` };
        }
        if (r() < 0.5) {
          const direct = rat(countThree((a, b, c) => a === b && b === c), 216);
          return { q: "Three fair dice are rolled. What is the probability that all three show the same number?", a: fmtFrac(direct), direct, short: rat(6, 216), how: "6 outcomes work (all 1s up to all 6s) out of 6 × 6 × 6 = 216. 6/216 = 1/36." };
        }
        const direct = rat(countThree((a, b, c) => a + b + c === 10), 216);
        const ways = countThree((a, b, c) => a + b + c === 10);
        return { q: "Three fair dice are rolled. What is the probability that the sum is 10?", a: fmtFrac(direct), direct, short: rat(ways, 216), how: `Count the triples that add to 10: ${ways} out of 216. ${ways}/216 = ${fmtFrac(direct)}.` };
      }
      if (level === 1) {
        const evs: [string, (x: number) => boolean][] = [
          ["an even number", (x) => x % 2 === 0],
          ["a prime number", isPrime],
          ["a multiple of 3", (x) => x % 3 === 0],
          ["a number greater than 4", (x) => x > 4],
          ["a factor of 6", (x) => 6 % x === 0],
          ["a number less than 3", (x) => x < 3],
          ["an odd number", (x) => x % 2 === 1],
          ["a number less than 5", (x) => x < 5],
          ["a number more than 2", (x) => x > 2],
          ["a multiple of 2 or 3", (x) => x % 2 === 0 || x % 3 === 0],
          ["a number between 2 and 6", (x) => x > 2 && x < 6],
          ["a perfect square", (x) => x === 1 || x === 4],
        ];
        const [name, f] = pick(r, evs);
        const c = countDie(f);
        const direct = rat(c, 6);
        const wanted = dieSet.filter(f).join(", ");
        return { q: `A fair die is rolled. What is the probability of getting ${name}?`, a: fmtFrac(direct), direct, short: rat(wanted.split(", ").length, 6), how: `Wanted: ${wanted}, which is ${c} outcomes out of 6. ${c}/6 = ${fmtFrac(direct)}.` };
      }
      if (level === 2) {
        const [red, blue, green] = [ri(r, 2, 12), ri(r, 2, 12), ri(r, 1, 10)];
        const total = red + blue + green;
        const [name, c] = pick(r, [["red", red], ["blue", blue], ["green", green]] as [string, number][]);
        const direct = rat(c, total);
        return { q: `A bag has ${red} red, ${blue} blue and ${green} green balls. One ball is picked at random. What is the probability that it is ${name}?`, a: fmtFrac(direct), direct, short: rat(c, red + blue + green), how: `Total balls: ${red} + ${blue} + ${green} = ${total}. ${name[0].toUpperCase()}${name.slice(1)}: ${c}. ${c}/${total} = ${fmtFrac(direct)}.` };
      }
      const s = ri(r, 2, 12);
      const direct = rat(countTwo((a, b) => a + b === s), 36);
      const short = rat(6 - Math.abs(s - 7), 36);
      return { q: `Two fair dice are rolled. What is the probability that the sum is ${s}?`, a: fmtFrac(direct), direct, short, how: `Ways to make ${s}: ${6 - Math.abs(s - 7)} out of 36 (the sum 7 has the most ways, 6, and each step away loses one). ${6 - Math.abs(s - 7)}/36 = ${fmtFrac(direct)}.` };
    },
  },
  {
    id: "pr-not",
    topic: "probability",
    title: "Use “not” when it is shorter",
    when: "“Not”, “at least”, “at most”: count the small side and take it from 1.",
    steps: ["P(not A) = 1 − P(A).", "If the opposite has fewer outcomes to count, count that.", "Subtract from 1."],
    make(level, r) {
      if (level >= 4) {
        const kind = pick(r, [0, 1, 2, 3].slice(0, Math.min(4, level - 3)));
        if (kind === 0) {
          const { red, blue, total } = bagBalls(r);
          const direct = rat(total * (total - 1) - blue * (blue - 1), total * (total - 1));
          const short = sub(rat(1), mul(rat(blue, total), rat(blue - 1, total - 1)));
          return { q: `A bag has ${red} red and ${blue} blue balls. Two balls are picked one after the other without putting the first back. What is the probability that at least one is red?`, a: fmtFrac(direct), direct, short, how: `Easier to count the opposite: both blue is ${blue}/${total} × ${blue - 1}/${total - 1} = ${fmtFrac(rat(blue * (blue - 1), total * (total - 1)))}. 1 minus that is ${fmtFrac(direct)}.` };
        }
        if (kind === 1) {
          const n = pick(r, [3, 4, 5]);
          const direct = rat(countCoins(n, (b) => headsCount(b) >= 1), 2 ** n);
          const short = sub(rat(1), rat(1, 2 ** n));
          return { q: `${n} fair coins are tossed together. What is the probability of at least one head?`, a: fmtFrac(direct), direct, short, how: `Only all tails fails: 1 out of ${2 ** n}. So 1 − 1/${2 ** n} = ${fmtFrac(direct)}.` };
        }
        if (kind === 2) {
          const direct = rat(countThree((a, b, c) => a === 6 || b === 6 || c === 6), 216);
          const short = sub(rat(1), mul(rat(5, 6), mul(rat(5, 6), rat(5, 6))));
          return { q: "Three fair dice are rolled. What is the probability that at least one shows a 6?", a: fmtFrac(direct), direct, short, how: "No 6 at all: 5/6 × 5/6 × 5/6 = 125/216. So 1 − 125/216 = 91/216." };
        }
        const n = 4;
        const k = pick(r, [2, 3]);
        const direct = rat(countCoins(n, (b) => headsCount(b) >= k), 2 ** n);
        const small = Array.from({ length: k }, (_, j) => nCk(n, j)).reduce((a, b) => a + b, 0);
        const short = sub(rat(1), rat(small, 2 ** n));
        return { q: `4 fair coins are tossed together. What is the probability of at least ${k} heads?`, a: fmtFrac(direct), direct, short, how: `Fewer than ${k} heads can happen in ${small} ways out of 16. So 1 − ${small}/16 = ${fmtFrac(direct)}.` };
      }
      if (level === 1) {
        const evs: [string, (x: number) => boolean][] = [
          ["a 6", (x) => x === 6],
          ["an even number", (x) => x % 2 === 0],
          ["a multiple of 3", (x) => x % 3 === 0],
          ["a prime number", isPrime],
          ["a number greater than 4", (x) => x > 4],
          ["an odd number", (x) => x % 2 === 1],
          ["a number less than 3", (x) => x < 3],
          ["a factor of 6", (x) => 6 % x === 0],
          ["a 1 or a 2", (x) => x <= 2],
        ];
        const [name, f] = pick(r, evs);
        const direct = rat(countDie((x) => !f(x)), 6);
        const short = sub(rat(1), rat(countDie(f), 6));
        return { q: `A fair die is rolled. What is the probability of NOT getting ${name}?`, a: fmtFrac(direct), direct, short, how: `P(${name}) = ${fmtFrac(rat(countDie(f), 6))}. So P(not) = 1 − ${fmtFrac(rat(countDie(f), 6))} = ${fmtFrac(direct)}.` };
      }
      if (level === 2) {
        const [red, blue, green] = [ri(r, 2, 12), ri(r, 2, 12), ri(r, 1, 10)];
        const total = red + blue + green;
        const [name, c] = pick(r, [["red", red], ["blue", blue], ["green", green]] as [string, number][]);
        const direct = rat(total - c, total);
        const short = sub(rat(1), rat(c, total));
        return { q: `A bag has ${red} red, ${blue} blue and ${green} green balls. One ball is picked at random. What is the probability that it is NOT ${name}?`, a: fmtFrac(direct), direct, short, how: `P(${name}) = ${c}/${total}. So P(not ${name}) = 1 − ${fmtFrac(rat(c, total))} = ${fmtFrac(direct)}.` };
      }
      const evs: [string, (a: number, b: number) => boolean, string, (a: number, b: number) => boolean][] = [
        ["the sum is at least 3", (a, b) => a + b >= 3, "the sum is 2", (a, b) => a + b < 3],
        ["at least one die shows 6", (a, b) => a === 6 || b === 6, "neither die shows 6", (a, b) => a !== 6 && b !== 6],
        ["the two numbers are different", (a, b) => a !== b, "the numbers are the same", (a, b) => a === b],
        ["the sum is less than 12", (a, b) => a + b < 12, "the sum is 12", (a, b) => a + b === 12],
        ["the product is more than 1", (a, b) => a * b > 1, "the product is 1", (a, b) => a * b === 1],
        ["the sum is not 7", (a, b) => a + b !== 7, "the sum is 7", (a, b) => a + b === 7],
        ["at least one die shows an even number", (a, b) => a % 2 === 0 || b % 2 === 0, "both dice show odd numbers", (a, b) => a % 2 === 1 && b % 2 === 1],
        ["the sum is more than 3", (a, b) => a + b > 3, "the sum is 2 or 3", (a, b) => a + b <= 3],
        ["the numbers are not both even", (a, b) => !(a % 2 === 0 && b % 2 === 0), "both numbers are even", (a, b) => a % 2 === 0 && b % 2 === 0],
        ["neither die shows 1", (a, b) => a !== 1 && b !== 1, "at least one die shows 1", (a, b) => a === 1 || b === 1],
      ];
      const [name, f, opp, g] = pick(r, evs);
      const direct = rat(countTwo(f), 36);
      const short = sub(rat(1), rat(countTwo(g), 36));
      return { q: `Two fair dice are rolled. What is the probability that ${name}?`, a: fmtFrac(direct), direct, short, how: `Easier to count the opposite: ${opp}, ${countTwo(g)} out of 36. So 1 − ${fmtFrac(rat(countTwo(g), 36))} = ${fmtFrac(direct)}.` };
    },
  },
  {
    id: "pr-or",
    topic: "probability",
    title: "Either-or: add the chances",
    when: "“This or that” where both cannot happen together.",
    steps: ["Check whether the two outcomes can happen together (overlap).", "Find each probability.", "Add them. If they can overlap, subtract the overlap once."],
    make(level, r) {
      if (level >= 4) {
        if (level >= 6 && r() < 0.5) {
          const direct = rat(countCoins(4, (b) => headsCount(b) >= 3 || (b & 1) === 1), 16);
          return { q: "4 fair coins are tossed together. What is the probability of at least 3 heads, or the first coin showing a head?", a: fmtFrac(direct), direct, short: rat(5 + 8 - 4, 16), how: "At least 3 heads: 5 ways. First coin a head: 8 ways. Both: 4 ways, counted twice. 5 + 8 − 4 = 9 out of 16." };
        }
        const pairs: [string, (a: number, b: number) => boolean, string, (a: number, b: number) => boolean][] = [
          ["the sum is 8", (a, b) => a + b === 8, "both dice show even numbers", (a, b) => a % 2 === 0 && b % 2 === 0],
          ["the first die shows 6", (a) => a === 6, "the sum is 9 or more", (a, b) => a + b >= 9],
          ["both numbers are the same", (a, b) => a === b, "the sum is 6", (a, b) => a + b === 6],
          ["the product is even", (a, b) => (a * b) % 2 === 0, "the sum is 7", (a, b) => a + b === 7],
          ["at least one die shows 6", (a, b) => a === 6 || b === 6, "the sum is 10", (a, b) => a + b === 10],
          ["the sum is even", (a, b) => (a + b) % 2 === 0, "the product is 12", (a, b) => a * b === 12],
          ["the first die shows an even number", (a) => a % 2 === 0, "the sum is 3", (a, b) => a + b === 3],
          ["the second die shows 1", (_a, b) => b === 1, "the sum is 4", (a, b) => a + b === 4],
          ["the sum is a multiple of 3", (a, b) => (a + b) % 3 === 0, "both numbers are odd", (a, b) => a % 2 === 1 && b % 2 === 1],
          ["the larger number is 5", (a, b) => Math.max(a, b) === 5, "the sum is 7", (a, b) => a + b === 7],
          ["the two numbers differ by 1", (a, b) => Math.abs(a - b) === 1, "the sum is 7", (a, b) => a + b === 7],
          ["the product is a multiple of 3", (a, b) => (a * b) % 3 === 0, "the sum is 8", (a, b) => a + b === 8],
        ];
        const [na, fa, nb, fb] = pick(r, pairs);
        const direct = rat(countTwo((a, b) => fa(a, b) || fb(a, b)), 36);
        const cA = countTwo(fa);
        const cB = countTwo(fb);
        const cAB = countTwo((a, b) => fa(a, b) && fb(a, b));
        const short = rat(cA + cB - cAB, 36);
        return { q: `Two fair dice are rolled. What is the probability that ${na}, or ${nb}?`, a: fmtFrac(direct), direct, short, how: `${na}: ${cA} ways. ${nb}: ${cB} ways. Both at once: ${cAB}, counted twice. ${cA} + ${cB} − ${cAB} = ${cA + cB - cAB} out of 36 = ${fmtFrac(direct)}.` };
      }
      if (level === 1) {
        const pairs: [string, (x: number) => boolean, string, (x: number) => boolean][] = [
          ["an even number", (x) => x % 2 === 0, "a 5", (x) => x === 5],
          ["a number less than 3", (x) => x < 3, "a number greater than 5", (x) => x > 5],
          ["a 1", (x) => x === 1, "a multiple of 3", (x) => x % 3 === 0],
          ["a 4", (x) => x === 4, "a prime number", isPrime],
        ];
        const x = ri(r, 1, 6);
        let y = ri(r, 1, 6);
        if (y === x) y = (x % 6) + 1;
        const useSingles = r() < 0.6;
        const [na, fa, nb, fb] = useSingles ? [`a ${x}`, (v: number) => v === x, `a ${y}`, (v: number) => v === y] : pick(r, pairs);
        const direct = rat(countDie((x) => fa(x) || fb(x)), 6);
        const short = rat(countDie(fa) + countDie(fb), 6);
        return { q: `A fair die is rolled. What is the probability of getting ${na} or ${nb}?`, a: fmtFrac(direct), direct, short, how: `They cannot both happen. ${countDie(fa)}/6 + ${countDie(fb)}/6 = ${countDie(fa) + countDie(fb)}/6 = ${fmtFrac(direct)}.` };
      }
      if (level === 2) {
        const [red, blue, green] = [ri(r, 2, 12), ri(r, 2, 12), ri(r, 1, 10)];
        const total = red + blue + green;
        const direct = rat(red + blue, total);
        const short = add(rat(red, total), rat(blue, total));
        return { q: `A bag has ${red} red, ${blue} blue and ${green} green balls. One ball is picked at random. What is the probability that it is red or blue?`, a: fmtFrac(direct), direct, short, how: `${red}/${total} + ${blue}/${total} = ${red + blue}/${total} = ${fmtFrac(direct)}.` };
      }
      const x = ri(r, 2, 12);
      let y = ri(r, 2, 12);
      if (y === x) y = x === 12 ? 2 : x + 1;
      const direct = rat(countTwo((a, b) => a + b === x || a + b === y), 36);
      const short = rat(6 - Math.abs(x - 7) + (6 - Math.abs(y - 7)), 36);
      return { q: `Two fair dice are rolled. What is the probability that the sum is ${x} or ${y}?`, a: fmtFrac(direct), direct, short, how: `Ways for ${x}: ${6 - Math.abs(x - 7)}. Ways for ${y}: ${6 - Math.abs(y - 7)}. They cannot both happen: ${6 - Math.abs(x - 7) + 6 - Math.abs(y - 7)}/36 = ${fmtFrac(direct)}.` };
    },
  },
  // ---------- physics: speed and motion ----------
  {
    id: "mo-sdt",
    topic: "motion",
    title: "Speed, distance, time",
    when: "Any question with a distance, a time and a speed.",
    steps: ["Speed = distance ÷ time. Distance = speed × time. Time = distance ÷ speed.", "Keep the units together: metres with seconds, kilometres with hours.", "If the time is in minutes, turn it into hours first (÷ 60)."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const v = ri(r, 2, 20), t = ri(r, 2, 12), d = v * t;
          return { q: `A cyclist covers ${d} m in ${t} s. What is the speed? (in m/s)`, direct: rat(d, t), short: rat(v), how: `Speed = distance ÷ time = ${d} ÷ ${t} = ${v} m/s.` };
        }
        if (level === 2) {
          const v = ri(r, 3, 40), t = ri(r, 3, 15);
          return { q: `A runner moves at ${v} m/s for ${t} s. How far does the runner go? (in m)`, direct: rat(v * t), short: mul(rat(v), rat(t)), how: `Distance = speed × time = ${v} × ${t} = ${v * t} m.` };
        }
        if (level === 3) {
          const v = ri(r, 4, 30), t = ri(r, 3, 20), d = v * t;
          return { q: `A car travels ${d} m at a steady ${v} m/s. How long does it take? (in s)`, direct: rat(d, v), short: rat(t), how: `Time = distance ÷ speed = ${d} ÷ ${v} = ${t} s.` };
        }
        const mins = pick(r, [12, 15, 20, 24, 30, 36, 40, 45, 48, 60, 90]);
        if (level === 4) {
          const v = 5 * ri(r, 4, 24), d = rat(v * mins, 60);
          return { q: `A bus covers ${fmt(d)} km in ${mins} minutes. What is its speed? (in km/h)`, direct: mul(d, rat(60, mins)), short: rat(v), how: `${mins} minutes is ${mins}/60 of an hour. Speed = ${fmt(d)} ÷ (${mins}/60) = ${v} km/h.` };
        }
        if (level === 5) {
          const v = 5 * ri(r, 4, 30);
          return { q: `A train runs at ${v} km/h for ${mins} minutes. How far does it go? (in km)`, direct: mul(rat(v), rat(mins, 60)), short: rat(v * mins, 60), how: `${v} × ${mins}/60 = ${fmt(rat(v * mins, 60))} km.` };
        }
        if (level === 6) {
          const v = 5 * ri(r, 4, 24), d = ri(r, 2, 30) * 5;
          return { q: `A bike goes at ${v} km/h. How many minutes does it take to cover ${d} km?`, direct: mul(rat(d, v), rat(60)), short: rat(d * 60, v), how: `Time in hours = ${d} ÷ ${v} = ${fmt(rat(d, v))} h. × 60 = ${fmt(rat(d * 60, v))} minutes.` };
        }
        if (level === 7) {
          const mn = pick(r, [2, 4, 5, 10, 12, 15]), vv = ri(r, 2, 20), d = vv * mn * 60;
          return { q: `A walker covers ${d} m in ${mn} minutes. What is the speed? (in m/s)`, direct: rat(d, mn * 60), short: rat(vv), how: `${mn} minutes = ${mn * 60} s. ${d} ÷ ${mn * 60} = ${vv} m/s.` };
        }
        const hr = ri(r, 1, 4), mn = pick(r, [15, 30, 45]), v = 4 * ri(r, 5, 30), d = rat(v * (hr * 60 + mn), 60);
        return { q: `A car covers ${fmt(d)} km in ${hr} h ${mn} min. What is its speed? (in km/h)`, direct: rat(d[0] * 60, d[1] * (hr * 60 + mn)), short: rat(v), how: `${hr} h ${mn} min = ${hr * 60 + mn} minutes = ${fmt(rat(hr * 60 + mn, 60))} h. ${fmt(d)} ÷ ${fmt(rat(hr * 60 + mn, 60))} = ${v} km/h.` };
      });
    },
  },
  {
    id: "mo-kmh",
    topic: "motion",
    title: "km/h and m/s: times 5 over 18",
    when: "A speed in km/h must become m/s, or the other way.",
    steps: ["km/h to m/s: multiply by 5, divide by 18.", "m/s to km/h: multiply by 18, divide by 5.", "Pick a km/h number that is a multiple of 18 (36, 54, 72, 90) for an easy whole answer."],
    make(level, r) {
      return phys(r, () => {
        if (level <= 3) {
          const k = level === 1 ? 18 * ri(r, 1, 8) : level === 2 ? 9 * ri(r, 1, 16) : 9 * ri(r, 1, 30);
          return { q: `Change ${k} km/h into m/s.`, direct: rat(k * 1000, 3600), short: mul(rat(k), rat(5, 18)), how: `${k} × 5 ÷ 18 = ${fmt(mul(rat(k), rat(5, 18)))} m/s.` };
        }
        if (level === 4) {
          const m = 5 * ri(r, 2, 20);
          return { q: `Change ${m} m/s into km/h.`, direct: rat(m * 3600, 1000), short: mul(rat(m), rat(18, 5)), how: `${m} × 18 ÷ 5 = ${m * 18 / 5} km/h.` };
        }
        if (level === 5) {
          const k = 9 * ri(r, 4, 24), m = 5 * ri(r, 2, 14);
          return { q: `A car moves at ${k} km/h and a runner at ${m} m/s. How much faster is the one that is quicker? (in m/s)`, direct: rat(Math.abs(k * 1000 - m * 3600), 3600), short: rat(Math.abs(k * 5 - m * 18), 18), how: `${k} km/h = ${fmt(mul(rat(k), rat(5, 18)))} m/s. Difference from ${m} m/s: ${fmt(rat(Math.abs(k * 5 - m * 18), 18))} m/s.` };
        }
        if (level === 6) {
          const k = 18 * ri(r, 2, 8), sec = ri(r, 3, 20), m = (k * 5) / 18;
          return { q: `A scooter moves at ${k} km/h. How far does it go in ${sec} s? (in m)`, direct: mul(rat(k * 1000, 3600), rat(sec)), short: rat(m * sec), how: `${k} km/h = ${m} m/s. ${m} × ${sec} = ${m * sec} m.` };
        }
        const k = 18 * ri(r, 2, 8), len = 10 * ri(r, 5, 30), v = (k * 5) / 18;
        if (level === 7) return { q: `A train ${len} m long runs at ${k} km/h. How many seconds does it take to pass a pole?`, direct: mul(rat(len), rat(3600, k * 1000)), short: rat(len, v), how: `${k} km/h = ${v} m/s. Time = ${len} ÷ ${v} = ${fmt(rat(len, v))} s.` };
        const pl = 10 * ri(r, 5, 30);
        return { q: `A train ${len} m long runs at ${k} km/h. How many seconds does it take to cross a platform ${pl} m long?`, direct: mul(rat(len + pl), rat(3600, k * 1000)), short: rat(len + pl, v), how: `${k} km/h = ${v} m/s. Distance to cover: ${len} + ${pl} = ${len + pl} m. ${len + pl} ÷ ${v} = ${fmt(rat(len + pl, v))} s.` };
      });
    },
  },
  {
    id: "mo-average",
    topic: "motion",
    title: "Average speed: total over total",
    when: "A journey in two or more parts at different speeds.",
    steps: ["Add up all the distance.", "Add up all the time.", "Average speed = total distance ÷ total time. Never just average the speeds."],
    make(level, r) {
      return phys(r, () => {
        if (level <= 2) {
          const t1 = ri(r, 2, 6), t2 = ri(r, 2, 6), v = ri(r, 4, 20), d1 = v * t1, d2 = v * t2 + (level === 2 ? 4 * ri(r, 1, 3) * (t2) : 0);
          return { q: `A boy runs ${d1} m in ${t1} s and then ${d2} m in ${t2} s. What is his average speed? (in m/s)`, direct: rat(d1 + d2, t1 + t2), short: mul(rat(d1 + d2), rat(1, t1 + t2)), how: `Total distance ${d1} + ${d2} = ${d1 + d2} m. Total time ${t1} + ${t2} = ${t1 + t2} s. ${d1 + d2} ÷ ${t1 + t2} = ${fmt(rat(d1 + d2, t1 + t2))} m/s.` };
        }
        if (level <= 4) {
          const v1 = 5 * ri(r, 2, 12), v2 = 5 * ri(r, 2, 12), t1 = ri(r, 1, 5), t2 = ri(r, 1, 5);
          return { q: `A car goes at ${v1} km/h for ${t1} h and then at ${v2} km/h for ${t2} h. What is its average speed? (in km/h)`, direct: rat(v1 * t1 + v2 * t2, t1 + t2), short: add(mul(rat(v1), rat(t1, t1 + t2)), mul(rat(v2), rat(t2, t1 + t2))), how: `Distance: ${v1 * t1} + ${v2 * t2} = ${v1 * t1 + v2 * t2} km. Time: ${t1 + t2} h. ${v1 * t1 + v2 * t2} ÷ ${t1 + t2} = ${fmt(rat(v1 * t1 + v2 * t2, t1 + t2))} km/h.` };
        }
        if (level <= 6) {
          const v1 = 5 * ri(r, 2, 14), v2 = 5 * ri(r, 2, 14);
          if (v1 === v2) throw RETRY;
          const D = ri(r, 1, 6) * 60;
          return { q: `A car goes from A to B at ${v1} km/h and comes back at ${v2} km/h along the same road. What is the average speed for the whole trip? (in km/h)`, direct: div(rat(2 * D), add(rat(D, v1), rat(D, v2))), short: rat(2 * v1 * v2, v1 + v2), how: `Same distance each way, so the average is 2 × ${v1} × ${v2} ÷ (${v1} + ${v2}) = ${fmt(rat(2 * v1 * v2, v1 + v2))} km/h. It is not ${fmt(rat(v1 + v2, 2))}, the plain average.` };
        }
        const v1 = 5 * ri(r, 3, 16), v2 = 5 * ri(r, 3, 16), v3 = 5 * ri(r, 3, 16), m1 = 6 * ri(r, 1, 8), m2 = 6 * ri(r, 1, 8), m3 = 6 * ri(r, 1, 8);
        const dist = rat(v1 * m1 + v2 * m2 + v3 * m3, 60), time = rat(m1 + m2 + m3, 60);
        return { q: `A cyclist rides at ${v1} km/h for ${m1} minutes, then ${v2} km/h for ${m2} minutes, then ${v3} km/h for ${m3} minutes. What is the average speed? (in km/h)`, direct: mul(dist, rat(time[1], time[0])), short: rat(v1 * m1 + v2 * m2 + v3 * m3, m1 + m2 + m3), how: `Minutes are in the same unit, so skip converting: (${v1} × ${m1} + ${v2} × ${m2} + ${v3} × ${m3}) ÷ ${m1 + m2 + m3} = ${fmt(rat(v1 * m1 + v2 * m2 + v3 * m3, m1 + m2 + m3))} km/h.` };
      });
    },
  },
  {
    id: "mo-relative",
    topic: "motion",
    title: "Add or subtract the speeds",
    when: "Two things move towards each other, or one chases the other.",
    steps: ["Towards each other: add the speeds.", "One chasing the other in the same direction: subtract the speeds.", "Time = gap ÷ that combined speed."],
    make(level, r) {
      return phys(r, () => {
        if (level <= 2) {
          const a = ri(r, 2, 15), b = ri(r, 2, 15), t = ri(r, 2, 12);
          return { q: `Two friends ${(a + b) * t} m apart walk towards each other at ${a} m/s and ${b} m/s. After how many seconds do they meet?`, direct: rat((a + b) * t, a + b), short: rat(t), how: `They close ${a + b} m every second. ${(a + b) * t} ÷ ${a + b} = ${t} s.` };
        }
        if (level <= 4) {
          const b = ri(r, 3, 15), a = b + ri(r, 1, 10), t = ri(r, 2, 15);
          return { q: `A scooter at ${a} m/s is ${(a - b) * t} m behind a cycle moving at ${b} m/s in the same direction. How many seconds before it catches up?`, direct: rat((a - b) * t, a - b), short: rat(t), how: `The scooter gains ${a - b} m every second. ${(a - b) * t} ÷ ${a - b} = ${t} s.` };
        }
        if (level <= 6) {
          const a = 5 * ri(r, 4, 16), b = 5 * ri(r, 4, 16), g = 5 * ri(r, 2, 30);
          return { q: `Two cars ${g} km apart drive towards each other at ${a} km/h and ${b} km/h. After how many minutes do they meet?`, direct: mul(rat(g, a + b), rat(60)), short: rat(g * 60, a + b), how: `Closing speed ${a} + ${b} = ${a + b} km/h. Time = ${g} ÷ ${a + b} h = ${fmt(rat(g * 60, a + b))} minutes.` };
        }
        const l1 = 10 * ri(r, 5, 20), l2 = 10 * ri(r, 5, 20), a = 18 * ri(r, 2, 6), b = 18 * ri(r, 2, 6);
        if (level === 7) return { q: `Two trains ${l1} m and ${l2} m long run towards each other on parallel tracks at ${a} km/h and ${b} km/h. How many seconds do they take to pass each other completely?`, direct: mul(rat(l1 + l2), rat(3600, (a + b) * 1000)), short: rat(l1 + l2, ((a + b) * 5) / 18), how: `Closing speed ${a} + ${b} = ${a + b} km/h = ${((a + b) * 5) / 18} m/s. Distance ${l1} + ${l2} = ${l1 + l2} m. Time = ${fmt(rat(l1 + l2, ((a + b) * 5) / 18))} s.` };
        const c = Math.max(a, b), d = Math.min(a, b);
        if (c === d) throw RETRY;
        return { q: `Two trains ${l1} m and ${l2} m long run in the same direction at ${c} km/h and ${d} km/h. How many seconds does the faster one take to pass the slower one completely?`, direct: mul(rat(l1 + l2), rat(3600, (c - d) * 1000)), short: rat(l1 + l2, ((c - d) * 5) / 18), how: `Gaining speed ${c} − ${d} = ${c - d} km/h = ${((c - d) * 5) / 18} m/s. Distance ${l1} + ${l2} = ${l1 + l2} m. Time = ${fmt(rat(l1 + l2, ((c - d) * 5) / 18))} s.` };
      });
    },
  },

  // ---------- physics: pressure ----------
  {
    id: "pr-fa",
    topic: "pressure",
    title: "Pressure = force ÷ area",
    when: "A force pushes on a surface and you want the pressure, the force or the area.",
    steps: ["Pressure = force ÷ area. Unit: pascal (Pa), which is newton per square metre.", "Area must be in square metres. 1 m² = 10 000 cm².", "To find force: pressure × area. A weight in newtons is mass in kg × 10."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const A = ri(r, 2, 10), P = ri(r, 5, 60);
          return { q: `A force of ${A * P} N acts on an area of ${A} m². What is the pressure? (in Pa)`, direct: rat(A * P, A), short: rat(P), how: `Pressure = ${A * P} ÷ ${A} = ${P} Pa.` };
        }
        if (level === 2) {
          const A = ri(r, 2, 12), P = ri(r, 20, 200);
          return { q: `A pressure of ${P} Pa acts on an area of ${A} m². What is the force? (in N)`, direct: rat(P * A), short: mul(rat(P), rat(A)), how: `Force = pressure × area = ${P} × ${A} = ${P * A} N.` };
        }
        if (level === 3) {
          const Acm = 10 * ri(r, 2, 40), P = 100 * ri(r, 2, 40), F = (P * Acm) / 10000;
          if (!Number.isInteger(F)) throw RETRY;
          return { q: `A force of ${F} N acts on an area of ${Acm} cm². What is the pressure? (in Pa)`, direct: div(rat(F), rat(Acm, 10000)), short: rat(F * 10000, Acm), how: `${Acm} cm² = ${fmt(rat(Acm, 10000))} m². Pressure = ${F} ÷ ${fmt(rat(Acm, 10000))} = ${P} Pa.` };
        }
        if (level === 4) {
          const m = 5 * ri(r, 2, 40), Acm = 5 * ri(r, 4, 40);
          return { q: `A box of mass ${m} kg rests on a base of area ${Acm} cm². Take g = 10 m/s². What pressure does it put on the floor? (in Pa)`, direct: rat(m * 10 * 10000, Acm), short: mul(rat(m * 10), rat(10000, Acm)), how: `Weight = ${m} × 10 = ${m * 10} N. Area = ${Acm} cm² = ${fmt(rat(Acm, 10000))} m². Pressure = ${m * 10} ÷ ${fmt(rat(Acm, 10000))} = ${fmt(rat(m * 100000, Acm))} Pa.` };
        }
        if (level === 5) {
          const dims = [2 * ri(r, 3, 12), 2 * ri(r, 3, 12), 2 * ri(r, 3, 12)].sort((x, y) => x - y);
          if (dims[0] === dims[1] || dims[1] === dims[2]) throw RETRY;
          const W = 4 * ri(r, 5, 50), small = r() < 0.5;
          const face = small ? dims[0] * dims[1] : dims[1] * dims[2];
          return { q: `A block ${dims.join(" cm × ")} cm weighs ${W} N. What pressure does it exert when it stands on its ${small ? "smallest" : "largest"} face? (in Pa)`, direct: mul(rat(W), rat(10000, face)), short: rat(W * 10000, face), how: `${small ? "Smallest" : "Largest"} face: ${face} cm² = ${fmt(rat(face, 10000))} m². Pressure = ${W} ÷ ${fmt(rat(face, 10000))} = ${fmt(rat(W * 10000, face))} Pa.` };
        }
        if (level === 6) {
          const P = 1000 * ri(r, 1, 30), Acm = 10 * ri(r, 5, 80);
          return { q: `A pressure of ${P} Pa acts on an area of ${Acm} cm². What is the force? (in N)`, direct: mul(rat(P), rat(Acm, 10000)), short: rat(P * Acm, 10000), how: `${Acm} cm² = ${fmt(rat(Acm, 10000))} m². Force = ${P} × ${fmt(rat(Acm, 10000))} = ${fmt(rat(P * Acm, 10000))} N.` };
        }
        if (level === 7) {
          const F = 50 * ri(r, 2, 40), Acm = 20 * ri(r, 2, 25);
          return { q: `A force of ${F} N acts on an area of ${Acm} cm². What is the pressure? (in kPa)`, direct: rat(F * 10000, Acm * 1000), short: rat(F * 10, Acm), how: `${F} ÷ ${fmt(rat(Acm, 10000))} = ${fmt(rat(F * 10000, Acm))} Pa = ${fmt(rat(F * 10, Acm))} kPa.` };
        }
        const m = 5 * ri(r, 8, 14), Acm = 10 * ri(r, 4, 30);
        return { q: `A girl of mass ${m} kg stands on two feet. Each foot touches the ground over ${Acm} cm². Take g = 10 m/s². What pressure does she put on the ground? (in kPa)`, direct: rat(m * 10 * 10000, 2 * Acm * 1000), short: rat(50 * m, Acm), how: `Weight ${m * 10} N. Total area 2 × ${Acm} = ${2 * Acm} cm² = ${fmt(rat(2 * Acm, 10000))} m². Pressure = ${fmt(rat(m * 100000, 2 * Acm))} Pa = ${fmt(rat(m * 100, 2 * Acm))} kPa.` };
      });
    },
  },
  {
    id: "pr-depth",
    topic: "pressure",
    title: "Pressure under a liquid: h × ρ × g",
    when: "How much pressure a liquid puts at a depth.",
    steps: ["Pressure = depth × density × g. Take g = 10 m/s².", "Water has density 1000 kg/m³, so every metre of water adds 10 000 Pa (10 kPa).", "Add the air pressure above the surface if the question asks for the total."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const h = ri(r, 1, 20);
          return { q: `A diver is ${h} m under water. Water adds 10 kPa for every metre. How much extra pressure is that? (in kPa)`, direct: rat(h * 1000 * 10, 1000), short: rat(h * 10), how: `${h} × 10 = ${h * 10} kPa.` };
        }
        if (level === 2) {
          const h = ri(r, 2, 25);
          return { q: `Find the pressure of water at a depth of ${h} m. Water: 1000 kg/m³, g = 10 m/s². (in Pa)`, direct: rat(h * 1000 * 10), short: mul(rat(h), rat(10000)), how: `Pressure = ${h} × 1000 × 10 = ${h * 10000} Pa.` };
        }
        if (level === 3) {
          const k = ri(r, 2, 15);
          return { q: `The pressure of water at the bottom of a tank is ${k * 10} kPa. How deep is the water? (in m). Water: 1000 kg/m³, g = 10 m/s².`, direct: rat(k * 10000, 1000 * 10), short: rat(k), how: `Depth = pressure ÷ (1000 × 10) = ${k * 10000} ÷ 10000 = ${k} m.` };
        }
        const liq = pick(r, [["oil", 800], ["water", 1000], ["salt water", 1200], ["mercury", 13600]] as [string, number][]);
        if (level === 4) {
          const h = liq[0] === "mercury" ? pick(r, [0.5, 0.75, 0.76, 0.25]) : ri(r, 2, 12);
          const hr = parseAnswer(String(h))!;
          return { q: `Find the pressure of ${liq[0]} (density ${liq[1]} kg/m³) at a depth of ${h} m. Take g = 10 m/s². (in kPa)`, direct: mul(mul(hr, rat(liq[1] * 10)), rat(1, 1000)), short: mul(hr, rat(liq[1], 100)), how: `${h} × ${liq[1]} × 10 = ${fmt(mul(hr, rat(liq[1] * 10)))} Pa = ${fmt(mul(hr, rat(liq[1], 100)))} kPa.` };
        }
        if (level === 5) {
          const h = ri(r, 2, 30);
          return { q: `The air above a lake presses with 100 kPa. What is the total pressure at ${h} m under the water? Water: 1000 kg/m³, g = 10 m/s². (in kPa)`, direct: add(rat(100), rat(h * 10000, 1000)), short: rat(100 + 10 * h), how: `Water: ${h} × 10 = ${h * 10} kPa. Add the air: 100 + ${h * 10} = ${100 + h * 10} kPa.` };
        }
        if (level === 6) {
          const h = ri(r, 2, 14), rho = pick(r, [800, 1000, 1200]);
          return { q: `A tank holds a liquid of density ${rho} kg/m³ to a height of ${h} m. The air pressure is 100 kPa and g = 10 m/s². What is the total pressure at the bottom? (in kPa)`, direct: add(rat(100), rat(h * rho * 10, 1000)), short: add(rat(100), mul(rat(h), rat(rho, 100))), how: `Liquid: ${h} × ${rho} × 10 = ${h * rho * 10} Pa = ${fmt(rat(h * rho * 10, 1000))} kPa. Plus air: ${fmt(add(rat(100), rat(h * rho * 10, 1000)))} kPa.` };
        }
        if (level === 7) {
          const h1 = ri(r, 1, 8), h2 = ri(r, 1, 8);
          return { q: `A tank holds ${h1} m of oil (800 kg/m³) floating on ${h2} m of water (1000 kg/m³). g = 10 m/s². What is the pressure caused by the liquids at the bottom? (in kPa)`, direct: rat(h1 * 800 * 10 + h2 * 1000 * 10, 1000), short: add(mul(rat(h1), rat(8)), mul(rat(h2), rat(10))), how: `Oil: ${h1} × 8 = ${h1 * 8} kPa. Water: ${h2} × 10 = ${h2 * 10} kPa. Together ${h1 * 8 + h2 * 10} kPa.` };
        }
        const k = ri(r, 2, 12);
        return { q: `At the bottom of a lake the total pressure is ${100 + k * 10} kPa. The air above presses with 100 kPa. How deep is the lake? (in m). Water: 1000 kg/m³, g = 10 m/s².`, direct: rat((100 + k * 10 - 100) * 1000, 10000), short: rat(k), how: `Water's share: ${100 + k * 10} − 100 = ${k * 10} kPa. Depth = ${k * 10} ÷ 10 = ${k} m.` };
      });
    },
  },
  {
    id: "pr-change",
    topic: "pressure",
    title: "What happens when force or area changes",
    when: "A question changes the force or the area and asks about the new pressure.",
    steps: ["Pressure goes up when the force goes up, and up when the area goes down.", "New pressure = old pressure × (force factor) ÷ (area factor).", "Percent changes: turn them into factors first (up 50% is × 1.5, down 25% is × 0.75)."],
    make(level, r) {
      return phys(r, () => {
        const P = 100 * ri(r, 2, 30);
        if (level <= 2) {
          const m = ri(r, 2, level === 1 ? 4 : 9);
          return { q: `A force makes a pressure of ${P} Pa. The same force now acts on an area ${m} times smaller. What is the new pressure? (in Pa)`, direct: rat(P * m), short: mul(rat(P), rat(m)), how: `Smaller area, bigger pressure: ${P} × ${m} = ${P * m} Pa.` };
        }
        if (level <= 4) {
          const m = ri(r, 2, 6), f = ri(r, 2, 5);
          return { q: `A pressure is ${P} Pa. The force becomes ${f} times as big and the area becomes ${m} times as big. What is the new pressure? (in Pa)`, direct: rat(P * f, m), short: mul(rat(P), rat(f, m)), how: `${P} × ${f} ÷ ${m} = ${fmt(rat(P * f, m))} Pa.` };
        }
        if (level <= 6) {
          const f = pick(r, [20, 25, 50, 75, 100]), g = pick(r, [20, 25, 40, 50]);
          return { q: `A pressure is ${P} Pa. The force goes up by ${f}% and the area goes down by ${g}%. What is the new pressure? (in Pa)`, direct: rat(P * (100 + f), 100 - g), short: mul(rat(P), mul(rat(100 + f, 100), rat(100, 100 - g))), how: `Force × ${fmt(rat(100 + f, 100))}, area × ${fmt(rat(100 - g, 100))}. ${P} × ${fmt(rat(100 + f, 100))} ÷ ${fmt(rat(100 - g, 100))} = ${fmt(rat(P * (100 + f), 100 - g))} Pa.` };
        }
        const F = 10 * ri(r, 2, 40), A1 = 5 * ri(r, 2, 20), A2 = 5 * ri(r, 2, 20);
        if (A1 === A2) throw RETRY;
        return { q: `A force of ${F} N is spread over ${A1} cm² and then over ${A2} cm². By how many pascals does the pressure change?`, direct: rat(Math.abs(F * 10000 * (A1 - A2)), A1 * A2), short: abs(sub(rat(F * 10000, A1), rat(F * 10000, A2))), how: `Pressure 1: ${F} ÷ ${fmt(rat(A1, 10000))} = ${fmt(rat(F * 10000, A1))} Pa. Pressure 2: ${fmt(rat(F * 10000, A2))} Pa. Difference ${fmt(rat(Math.abs(F * 10000 * (A1 - A2)), A1 * A2))} Pa.` };
      });
    },
  },

  // ---------- physics: sound ----------
  {
    id: "so-freq",
    topic: "sound",
    title: "Frequency and time period: flip it",
    when: "A question gives a frequency and asks for the time period, or the other way round.",
    steps: ["Time period T = 1 ÷ frequency f. Frequency = 1 ÷ time period.", "Frequency is in hertz (Hz), time period in seconds.", "For milliseconds: 1 ms is 0.001 s, so f = 1000 ÷ (T in ms)."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const f = pick(r, [2, 4, 5, 8, 10, 20, 25, 40, 50, 100]);
          return { q: `A vibrating string has a frequency of ${f} Hz. What is its time period? (in s)`, direct: rat(1, f), short: rat(1, f), how: `T = 1 ÷ ${f} = ${fmt(rat(1, f))} s.` };
        }
        if (level === 2) {
          const T = pick(r, [0.5, 0.25, 0.2, 0.1, 0.05, 0.04, 0.02, 0.01]);
          const tr = parseAnswer(String(T))!;
          return { q: `A pendulum has a time period of ${T} s. What is its frequency? (in Hz)`, direct: mul(rat(1), rat(tr[1], tr[0])), short: rat(tr[1], tr[0]), how: `f = 1 ÷ ${T} = ${fmt(rat(tr[1], tr[0]))} Hz.` };
        }
        if (level === 3) {
          const t = ri(r, 2, 12) * 5, n = pick(r, [10, 20, 30, 40, 50, 60]);
          return { q: `A pendulum makes ${n} oscillations in ${t} s. What is its frequency? (in Hz)`, direct: rat(n, t), short: mul(rat(n), rat(1, t)), how: `Frequency = oscillations ÷ time = ${n} ÷ ${t} = ${fmt(rat(n, t))} Hz.` };
        }
        if (level === 4) {
          const ms = pick(r, [1, 2, 4, 5, 8, 10, 20, 25, 40, 50]);
          return { q: `A wave has a time period of ${ms} milliseconds. What is its frequency? (in Hz)`, direct: div(rat(1), rat(ms, 1000)), short: rat(1000, ms), how: `${ms} ms = ${fmt(rat(ms, 1000))} s. f = 1 ÷ ${fmt(rat(ms, 1000))} = ${fmt(rat(1000, ms))} Hz.` };
        }
        if (level === 5) {
          const f = pick(r, [125, 200, 250, 400, 500, 1000, 2000, 5000]);
          return { q: `A sound has a frequency of ${f} Hz. What is its time period? (in milliseconds)`, direct: mul(rat(1, f), rat(1000)), short: rat(1000, f), how: `T = 1 ÷ ${f} s. In milliseconds: 1000 ÷ ${f} = ${fmt(rat(1000, f))} ms.` };
        }
        if (level === 6) {
          const T = pick(r, [0.5, 0.25, 0.2, 0.1, 0.05]), tr = parseAnswer(String(T))!;
          const sec = ri(r, 2, 12) * 6;
          return { q: `A tuning fork has a time period of ${T} s. How many vibrations does it make in ${sec} s?`, direct: mul(rat(sec), rat(tr[1], tr[0])), short: rat(sec * tr[1], tr[0]), how: `f = 1 ÷ ${T} = ${fmt(rat(tr[1], tr[0]))} Hz. In ${sec} s: ${fmt(rat(tr[1], tr[0]))} × ${sec} = ${fmt(rat(sec * tr[1], tr[0]))} vibrations.` };
        }
        if (level === 7) {
          const f = pick(r, [20, 25, 40, 50, 100, 125, 200, 250, 500, 1000, 2000, 10000]);
          return { q: `A bat makes sound at ${f} kHz. Find its time period in microseconds. (1 kHz = 1000 Hz, 1 µs = 0.000001 s)`, direct: mul(rat(1, f * 1000), rat(1000000)), short: rat(1000, f), how: `${f} kHz = ${f * 1000} Hz. T = 1 ÷ ${f * 1000} s = ${fmt(rat(1000, f))} µs.` };
        }
        const f1 = pick(r, [100, 200, 250, 500]), f2 = pick(r, [20, 40, 50, 25]);
        return { q: `Sound A has frequency ${f1} Hz and sound B has ${f2} Hz. By how many milliseconds is the time period of B longer than that of A?`, direct: mul(sub(rat(1, f2), rat(1, f1)), rat(1000)), short: sub(rat(1000, f2), rat(1000, f1)), how: `A: 1000 ÷ ${f1} = ${fmt(rat(1000, f1))} ms. B: 1000 ÷ ${f2} = ${fmt(rat(1000, f2))} ms. Difference ${fmt(sub(rat(1000, f2), rat(1000, f1)))} ms.` };
      });
    },
  },
  {
    id: "so-echo",
    topic: "sound",
    title: "Echo: there and back",
    when: "Sound goes to a wall, a cliff or the sea floor and comes back.",
    steps: ["Distance = speed × time for one way.", "An echo travels there AND back, so the distance to the wall is speed × time ÷ 2.", "Take the speed of sound in air as 344 m/s unless the question says otherwise."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const t = ri(r, 2, 10);
          return { q: `Thunder is heard ${t} s after the flash. Sound travels at 344 m/s. How far is the lightning? (in m)`, direct: rat(344 * t), short: mul(rat(344), rat(t)), how: `Light arrives at once. Distance = 344 × ${t} = ${344 * t} m.` };
        }
        if (level === 2) {
          const t = pick(r, [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]), tr = parseAnswer(String(t))!;
          return { q: `A boy shouts at a cliff and hears the echo after ${t} s. Sound travels at 344 m/s. How far is the cliff? (in m)`, direct: mul(mul(rat(344), tr), rat(1, 2)), short: mul(rat(172), tr), how: `The sound goes and comes back. 344 × ${t} ÷ 2 = ${fmt(mul(rat(172), tr))} m.` };
        }
        if (level === 3) {
          const d = 43 * 2 * ri(r, 1, 12);
          return { q: `A wall is ${d} m away. After how many seconds will you hear your own echo? Sound travels at 344 m/s.`, direct: rat(2 * d, 344), short: mul(rat(d), rat(1, 172)), how: `Distance there and back is 2 × ${d} = ${2 * d} m. Time = ${2 * d} ÷ 344 = ${fmt(rat(2 * d, 344))} s.` };
        }
        if (level === 4) {
          const v = pick(r, [330, 332, 336, 340, 344, 348, 350, 352, 360]);
          return { q: `We need at least 0.1 s between a sound and its echo to hear them separately. If sound travels at ${v} m/s, what is the smallest distance to the wall? (in m)`, direct: mul(mul(rat(v), rat(1, 10)), rat(1, 2)), short: rat(v, 20), how: `Distance there and back in 0.1 s: ${v} × 0.1 = ${fmt(rat(v, 10))} m. The wall is half of that: ${fmt(rat(v, 20))} m.` };
        }
        if (level === 5) {
          const t = ri(r, 2, 20) * 2, v = pick(r, [1500, 1480, 1400, 1600]);
          return { q: `A ship's sonar sends a pulse and hears the echo from the sea floor after ${t / 2} s. Sound travels at ${v} m/s in sea water. How deep is the sea? (in m)`, direct: mul(mul(rat(v), rat(t, 2)), rat(1, 2)), short: rat(v * t, 4), how: `Down and back: ${v} × ${t / 2} = ${v * t / 2} m. Depth is half: ${fmt(rat(v * t, 4))} m.` };
        }
        if (level === 6) {
          const k = ri(r, 1, 8), t1 = k, t2 = k + ri(r, 1, 4);
          return { q: `A man stands between two cliffs. He hears the first echo after ${t1} s and the second after ${t2} s. Sound travels at 344 m/s. How far apart are the cliffs? (in m)`, direct: add(mul(rat(344 * t1), rat(1, 2)), mul(rat(344 * t2), rat(1, 2))), short: mul(rat(172), rat(t1 + t2)), how: `Distance to first: 344 × ${t1} ÷ 2 = ${172 * t1} m. To second: 344 × ${t2} ÷ 2 = ${172 * t2} m. Total ${172 * (t1 + t2)} m.` };
        }
        if (level === 7) {
          const t0 = ri(r, 2, 6), j = ri(r, 1, 4 * t0 - 1), x = 43 * j, d = 172 * t0;
          return { q: `A girl hears the echo from a cliff after ${t0} s (sound: 344 m/s). She walks ${x} m towards the cliff. How long does the echo take now? (in s)`, direct: rat(2 * (d - x), 344), short: sub(rat(t0), rat(2 * x, 344)), how: `The cliff was 344 × ${t0} ÷ 2 = ${d} m away. Now it is ${d - x} m. Time = 2 × ${d - x} ÷ 344 = ${fmt(rat(2 * (d - x), 344))} s.` };
        }
        const v = pick(r, [340, 346, 355, 360]), k = 2 * ri(r, 1, 6);
        return { q: `On a hot day sound travels at ${v} m/s. A boy hears the echo of his clap from a cliff after ${k} s. How far is the cliff? (in m)`, direct: mul(mul(rat(v), rat(k)), rat(1, 2)), short: rat(v * (k / 2)), how: `Distance = ${v} × ${k} ÷ 2 = ${v * (k / 2)} m.` };
      });
    },
  },
  {
    id: "so-wave",
    topic: "sound",
    title: "Speed = frequency × wavelength",
    when: "A wave has a frequency and a wavelength, or you need one of them.",
    steps: ["Wave speed v = frequency f × wavelength λ.", "To find the wavelength: λ = v ÷ f. To find the frequency: f = v ÷ λ.", "Use metres and hertz, and the speed comes out in m/s."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const f = ri(r, 2, 20), l = ri(r, 2, 12);
          return { q: `A wave has frequency ${f} Hz and wavelength ${l} m. What is its speed? (in m/s)`, direct: rat(f * l), short: mul(rat(f), rat(l)), how: `v = f × λ = ${f} × ${l} = ${f * l} m/s.` };
        }
        if (level === 2) {
          const f = ri(r, 2, 10), l = ri(r, 2, 12);
          return { q: `A wave moves at ${f * l} m/s and has frequency ${f} Hz. What is its wavelength? (in m)`, direct: rat(f * l, f), short: rat(l), how: `λ = v ÷ f = ${f * l} ÷ ${f} = ${l} m.` };
        }
        if (level === 3) {
          const l = ri(r, 2, 12), f = ri(r, 2, 12);
          return { q: `A wave moves at ${f * l} m/s and has wavelength ${l} m. What is its frequency? (in Hz)`, direct: rat(f * l, l), short: rat(f), how: `f = v ÷ λ = ${f * l} ÷ ${l} = ${f} Hz.` };
        }
        if (level === 4) {
          const f = pick(r, [2, 4, 8, 43, 86, 172, 344, 688, 1376, 2752]);
          return { q: `Sound travels at 344 m/s in air. What is the wavelength of a ${f} Hz note? (in m)`, direct: rat(344, f), short: rat(344, f), how: `λ = 344 ÷ ${f} = ${fmt(rat(344, f))} m.` };
        }
        if (level === 5) {
          const T = pick(r, [0.5, 0.25, 0.2, 0.1, 0.05, 0.02]), tr = parseAnswer(String(T))!, v = pick(r, [20, 40, 100, 200, 344]);
          return { q: `A wave has time period ${T} s and speed ${v} m/s. What is its wavelength? (in m)`, direct: mul(rat(v), tr), short: rat(v * tr[0], tr[1]), how: `λ = v × T = ${v} × ${T} = ${fmt(mul(rat(v), tr))} m.` };
        }
        if (level === 6) {
          const f = pick(r, [20, 40, 43, 86, 100, 172, 200, 2000, 20000]);
          return { q: `Sound travels at 344 m/s. What is the wavelength of a sound of ${f} Hz? (in m)`, direct: rat(344, f), short: rat(344, f), how: `λ = 344 ÷ ${f} = ${fmt(rat(344, f))} m.` };
        }
        if (level === 7) {
          const f = pick(r, [86, 172, 344]), d = 344 * ri(r, 2, 10);
          return { q: `A ${f} Hz sound travels at 344 m/s. How many wavelengths fit in a distance of ${d} m?`, direct: rat(d, 344 / f), short: mul(rat(d), rat(f, 344)), how: `λ = 344 ÷ ${f} = ${fmt(rat(344, f))} m. ${d} ÷ ${fmt(rat(344, f))} = ${fmt(rat(d * f, 344))}.` };
        }
        const f = pick(r, [100, 200, 400, 500]), v1 = 344, v2 = pick(r, [1376, 1720, 5160, 1032]);
        return { q: `A ${f} Hz sound goes from air (344 m/s) into a liquid where it travels at ${v2} m/s. The frequency stays the same. What is the wavelength in the liquid? (in m)`, direct: rat(v2, f), short: mul(rat(v2, v1), rat(v1, f)), how: `Frequency does not change. λ = v ÷ f = ${v2} ÷ ${f} = ${fmt(rat(v2, f))} m.` };
      });
    },
  },

  // ---------- physics: light ----------
  {
    id: "li-reflect",
    topic: "light",
    title: "Angle in = angle out",
    when: "A ray of light hits a flat mirror.",
    steps: ["Angle of incidence = angle of reflection. Both are measured from the normal, the line at 90° to the mirror.", "The angle between the ray and the mirror itself is 90° minus the angle from the normal.", "The angle between the incident and reflected rays is twice the angle of incidence."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const i = 5 * ri(r, 2, 16);
          return { q: `A ray strikes a mirror with angle of incidence ${i}°. What is the angle of reflection? (in degrees)`, direct: rat(i), short: rat(i), how: `Angle of reflection = angle of incidence = ${i}°.` };
        }
        if (level === 2) {
          const i = 5 * ri(r, 2, 16);
          return { q: `The angle of incidence is ${i}°. What is the angle between the incident ray and the reflected ray? (in degrees)`, direct: add(rat(i), rat(i)), short: mul(rat(2), rat(i)), how: `The reflected angle is also ${i}°. Together ${i} + ${i} = ${2 * i}°.` };
        }
        if (level === 3) {
          const m = 5 * ri(r, 2, 16);
          return { q: `A ray makes an angle of ${m}° with the mirror surface. What is the angle of reflection? (in degrees)`, direct: sub(rat(90), rat(m)), short: rat(90 - m), how: `The normal is 90° from the mirror, so the angle of incidence is 90 − ${m} = ${90 - m}°. The angle of reflection is the same: ${90 - m}°.` };
        }
        if (level === 4) {
          const t = 10 * ri(r, 2, 16);
          return { q: `The angle between the incident ray and the reflected ray is ${t}°. What is the angle of incidence? (in degrees)`, direct: rat(t, 2), short: mul(rat(t), rat(1, 2)), how: `The two angles are equal and add up to ${t}°. Each is ${t} ÷ 2 = ${t / 2}°.` };
        }
        if (level === 5) {
          const th = 5 * ri(r, 1, 12);
          return { q: `A mirror is turned by ${th}° while the incident ray stays still. By what angle does the reflected ray turn? (in degrees)`, direct: add(rat(th), rat(th)), short: rat(2 * th), how: `A turned mirror moves the reflected ray twice as much: 2 × ${th} = ${2 * th}°.` };
        }
        if (level === 6) {
          const i = 5 * ri(r, 2, 14), th = 5 * ri(r, 1, 8);
          return { q: `A ray hits a mirror with angle of incidence ${i}°. The mirror is turned by ${th}° so that the angle of incidence grows. What is the new angle between the incident and reflected rays? (in degrees)`, direct: mul(rat(2), add(rat(i), rat(th))), short: rat(2 * i + 2 * th), how: `New angle of incidence ${i} + ${th} = ${i + th}°. Between the rays: 2 × ${i + th} = ${2 * (i + th)}°.` };
        }
        if (level === 7) {
          const m = 5 * ri(r, 2, 16);
          return { q: `A ray makes an angle of ${m}° with a mirror. What is the angle between the incident ray and the reflected ray? (in degrees)`, direct: mul(rat(2), sub(rat(90), rat(m))), short: rat(180 - 2 * m), how: `Angle of incidence = 90 − ${m} = ${90 - m}°. Between the rays: 2 × ${90 - m} = ${180 - 2 * m}°.` };
        }
        const a = 5 * ri(r, 2, 14), th = 5 * ri(r, 1, 6);
        return { q: `A ray is reflected by a mirror. The angle between the incident ray and the mirror is ${a}°. The mirror is then rotated by ${th}° away from the ray, so the angle between ray and mirror becomes ${a + th}°. By what angle has the reflected ray moved? (in degrees)`, direct: sub(mul(rat(2), sub(rat(90), rat(a))), mul(rat(2), sub(rat(90), rat(a + th)))), short: rat(2 * th), how: `Before: angle of incidence ${90 - a}°, rays ${2 * (90 - a)}° apart. After: ${90 - a - th}° and ${2 * (90 - a - th)}° apart. The reflected ray moved ${2 * th}°, twice the turn of the mirror.` };
      });
    },
  },
  {
    id: "li-plane",
    topic: "light",
    title: "Plane mirror: the image is as far behind as you are in front",
    when: "Distance, height or movement in front of a flat mirror.",
    steps: ["The image is as far behind the mirror as the object is in front.", "So the distance from the object to its image is twice the distance to the mirror.", "If you move at a speed v towards the mirror, the image comes towards you at 2v."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const d = ri(r, 1, 12);
          return { q: `A candle is ${d} m in front of a plane mirror. How far behind the mirror is its image? (in m)`, direct: rat(d), short: rat(d), how: `The image is as far behind the mirror as the candle is in front: ${d} m.` };
        }
        if (level === 2) {
          const d = ri(r, 1, 12);
          return { q: `A boy stands ${d} m from a plane mirror. How far is he from his image? (in m)`, direct: add(rat(d), rat(d)), short: mul(rat(2), rat(d)), how: `${d} m to the mirror and ${d} m behind it: ${d} + ${d} = ${2 * d} m.` };
        }
        if (level === 3) {
          const d = ri(r, 4, 15), x = ri(r, 1, d - 1);
          return { q: `A girl stands ${d} m from a mirror and walks ${x} m towards it. How far is she now from her image? (in m)`, direct: mul(rat(2), sub(rat(d), rat(x))), short: rat(2 * d - 2 * x), how: `She is now ${d - x} m from the mirror, so ${2 * (d - x)} m from her image.` };
        }
        if (level === 4) {
          const v = ri(r, 1, 18) / 2;
          return { q: `A boy walks towards a plane mirror at ${v} m/s. At what speed does his image come towards him? (in m/s)`, direct: add(rat(v), rat(v)), short: rat(2 * v), how: `He moves ${v} m/s and the image moves ${v} m/s the other way. They close in at ${2 * v} m/s.` };
        }
        if (level === 5) {
          const h = 10 * ri(r, 12, 20);
          return { q: `A person ${h} cm tall wants to see the whole of themselves in a plane mirror. What is the shortest mirror needed? (in cm)`, direct: rat(h, 2), short: mul(rat(h), rat(1, 2)), how: `The mirror only needs to be half the person's height: ${h} ÷ 2 = ${h / 2} cm.` };
        }
        if (level === 6) {
          const x = ri(r, 1, 9), d = ri(r, 3, 9);
          return { q: `A candle is ${d} m from a plane mirror. The mirror is moved ${x} m away from the candle. By how much does the image move? (in m)`, direct: sub(mul(rat(2), rat(d + x)), mul(rat(2), rat(d))), short: rat(2 * x), how: `The image is as far behind the mirror as the candle is in front. Before ${2 * d} m from candle, after ${2 * (d + x)} m: the image moves ${2 * x} m.` };
        }
        if (level === 7) {
          const d = ri(r, 3, 10), v = ri(r, 1, 4);
          return { q: `A boy ${d} m from a mirror walks towards it at ${v} m/s. How fast does his image move relative to the mirror (the ground)? (in m/s)`, direct: rat(v), short: rat(v), how: `The image moves the same speed as the boy, ${v} m/s, but in the opposite direction. Relative to the boy it comes at ${2 * v} m/s.` };
        }
        const d = ri(r, 6, 20), v = ri(r, 1, 3), t = ri(r, 1, Math.floor((d - 1) / v));
        return { q: `A boy ${d} m from a plane mirror walks towards it at ${v} m/s for ${t} s. How far is he then from his image? (in m)`, direct: mul(rat(2), sub(rat(d), rat(v * t))), short: rat(2 * d - 2 * v * t), how: `He walks ${v * t} m, so he is ${d - v * t} m from the mirror and ${2 * (d - v * t)} m from his image.` };
      });
    },
  },
  {
    id: "li-lens",
    topic: "light",
    title: "Focal length and lens power",
    when: "A mirror's radius, a lens's focal length, or its power in dioptres.",
    steps: ["Focal length of a curved mirror = radius ÷ 2.", "Power of a lens (dioptre) = 1 ÷ focal length in metres = 100 ÷ focal length in cm.", "Powers of lenses placed together add. Lens formula: 1/v − 1/u = 1/f (u is negative for a real object)."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const R = 10 * ri(r, 1, 10);
          return { q: `A curved mirror has a radius of curvature of ${R} cm. What is its focal length? (in cm)`, direct: rat(R, 2), short: mul(rat(R), rat(1, 2)), how: `f = R ÷ 2 = ${R} ÷ 2 = ${R / 2} cm.` };
        }
        if (level === 2) {
          const f = 5 * ri(r, 1, 20);
          return { q: `A concave mirror has a focal length of ${f} cm. What is its radius of curvature? (in cm)`, direct: rat(2 * f), short: mul(rat(f), rat(2)), how: `R = 2 × f = 2 × ${f} = ${2 * f} cm.` };
        }
        if (level === 3) {
          const f = pick(r, [10, 20, 25, 50, 100, 200, 4, 5]);
          return { q: `A convex lens has a focal length of ${f} cm. What is its power? (in dioptres)`, direct: mul(rat(1), rat(100, f)), short: rat(100, f), how: `P = 100 ÷ ${f} = ${fmt(rat(100, f))} D.` };
        }
        if (level === 4) {
          const p1 = pick(r, [1, 2, 2.5, 4, 5]), p2 = pick(r, [0.5, 1, 1.5, 2, 3]);
          const a = parseAnswer(String(p1))!, b = parseAnswer(String(p2))!;
          return { q: `Two thin lenses of power ${p1} D and ${p2} D are put close together. What is their combined power? (in dioptres)`, direct: add(a, b), short: add(b, a), how: `Powers add: ${p1} + ${p2} = ${fmt(add(a, b))} D.` };
        }
        if (level === 5) {
          const P = pick(r, [0.25, 0.5, 1, 1.25, 2, 2.5, 4, 5, 10, 20]), pr = parseAnswer(String(P))!;
          return { q: `A lens has a power of ${P} D. What is its focal length? (in cm)`, direct: mul(rat(1), rat(100 * pr[1], pr[0])), short: rat(100 * pr[1], pr[0]), how: `f = 100 ÷ ${P} = ${fmt(rat(100 * pr[1], pr[0]))} cm.` };
        }
        if (level === 6) {
          const a = pick(r, [20, 25, 50, 100]), b = pick(r, [20, 25, 50, 100]);
          return { q: `Two thin lenses with focal lengths ${a} cm and ${b} cm are placed close together. What is the power of the pair? (in dioptres)`, direct: add(rat(100, a), rat(100, b)), short: rat(100 * (a + b), a * b), how: `${fmt(rat(100, a))} D + ${fmt(rat(100, b))} D = ${fmt(add(rat(100, a), rat(100, b)))} D.` };
        }
        const f = pick(r, [12, 20, 24, 30, 40, 60]), nn = pick(r, [1, 2, 3, 4, 5]), u = (-f * (nn + 1)) / nn;
        if (!Number.isInteger(u)) throw RETRY;
        if (level === 7) {
          const v = (f * Math.abs(u)) / (Math.abs(u) - f);
          return { q: `An object is ${-u} cm in front of a convex lens of focal length ${f} cm. How far from the lens is the image? Use 1/v − 1/u = 1/f, with u = ${u}. (in cm)`, direct: div(rat(1), add(rat(1, f), rat(1, u))), short: rat(v), how: `1/v = 1/f + 1/u = 1/${f} − 1/${-u} = ${fmt(rat(-u - f, f * -u))}. So v = ${fmt(rat(f * -u, -u - f))} cm.` };
        }
        const v = (f * -u) / (-u - f);
        return { q: `An object is ${-u} cm in front of a convex lens of focal length ${f} cm. What is the magnification (image size ÷ object size, ignore the sign)?`, direct: div(rat(v), rat(-u)), short: rat(f, -u - f), how: `v = ${fmt(rat(f * -u, -u - f))} cm. Magnification = v ÷ u = ${fmt(rat(v))} ÷ ${-u} = ${fmt(rat(f, -u - f))}.` };
      });
    },
  },

  // ---------- physics: electricity ----------
  {
    id: "el-ohm",
    topic: "electricity",
    title: "Ohm's law: V = I × R",
    when: "A circuit with a voltage, a current and resistances.",
    steps: ["Voltage V = current I × resistance R.", "Resistors in a line (series): add them. Two equal resistors side by side (parallel): halve the resistance.", "Two different resistors in parallel: (product) ÷ (sum)."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const I = ri(r, 1, 6), R = ri(r, 2, 20);
          return { q: `A current of ${I} A flows through a ${R} Ω resistor. What is the voltage across it? (in V)`, direct: rat(I * R), short: mul(rat(I), rat(R)), how: `V = I × R = ${I} × ${R} = ${I * R} V.` };
        }
        if (level === 2) {
          const R = ri(r, 2, 12), I = ri(r, 1, 8);
          return { q: `A ${I * R} V battery is connected across a ${R} Ω resistor. What current flows? (in A)`, direct: rat(I * R, R), short: rat(I), how: `I = V ÷ R = ${I * R} ÷ ${R} = ${I} A.` };
        }
        if (level === 3) {
          const I = ri(r, 1, 6), R = ri(r, 3, 25);
          return { q: `A ${I * R} V supply drives a current of ${I} A. What is the resistance? (in Ω)`, direct: rat(I * R, I), short: rat(R), how: `R = V ÷ I = ${I * R} ÷ ${I} = ${R} Ω.` };
        }
        if (level === 4) {
          const a = ri(r, 2, 15), b = ri(r, 2, 15), I = ri(r, 1, 5);
          return { q: `Two resistors of ${a} Ω and ${b} Ω are joined in series across a battery. A current of ${I} A flows. What is the battery voltage? (in V)`, direct: mul(rat(I), rat(a + b)), short: add(rat(I * a), rat(I * b)), how: `Total resistance ${a} + ${b} = ${a + b} Ω. V = ${I} × ${a + b} = ${I * (a + b)} V.` };
        }
        if (level === 5) {
          const R = 2 * ri(r, 2, 20);
          return { q: `Two identical ${R} Ω resistors are joined in parallel. What is their combined resistance? (in Ω)`, direct: rat(R * R, 2 * R), short: rat(R, 2), how: `Identical resistors in parallel: ${R} ÷ 2 = ${R / 2} Ω.` };
        }
        if (level === 6) {
          const pairs: [number, number][] = [[6, 3], [12, 4], [20, 5], [10, 15], [30, 20], [12, 6], [4, 12], [60, 20], [30, 15], [8, 24], [9, 18], [20, 30]];
          const [a, b] = pick(r, pairs);
          return { q: `Resistors of ${a} Ω and ${b} Ω are joined in parallel. What is the combined resistance? (in Ω)`, direct: mul(rat(1), rat(a * b, a + b)), short: rat(a * b, a + b), how: `Product ÷ sum = ${a} × ${b} ÷ (${a} + ${b}) = ${a * b} ÷ ${a + b} = ${fmt(rat(a * b, a + b))} Ω.` };
        }
        const pairs: [number, number][] = [[6, 3], [12, 4], [20, 5], [10, 15], [30, 20], [12, 6], [4, 12]];
        const [a, b] = pick(r, pairs), c = ri(r, 2, 15), V = pick(r, [6, 12, 24, 30, 60]);
        const Rp = rat(a * b, a + b), Rt = add(Rp, rat(c));
        if (level === 7) {
          return { q: `${a} Ω and ${b} Ω in parallel are joined in series with a ${c} Ω resistor. What is the total resistance? (in Ω)`, direct: add(rat(c), rat(a * b, a + b)), short: Rt, how: `Parallel part: ${a} × ${b} ÷ ${a + b} = ${fmt(Rp)} Ω. Add ${c} Ω in series: ${fmt(Rt)} Ω.` };
        }
        return { q: `${a} Ω and ${b} Ω in parallel are joined in series with a ${c} Ω resistor, and a ${V} V battery is connected across the whole circuit. What current flows from the battery? (in A)`, direct: mul(rat(V), rat(Rt[1], Rt[0])), short: rat(V * Rt[1], Rt[0]), how: `Total resistance: ${fmt(Rp)} + ${c} = ${fmt(Rt)} Ω. I = ${V} ÷ ${fmt(Rt)} = ${fmt(rat(V * Rt[1], Rt[0]))} A.` };
      });
    },
  },
  {
    id: "el-power",
    topic: "electricity",
    title: "Power = V × I",
    when: "How much power an appliance uses, or the current it draws.",
    steps: ["Power (watts) = voltage × current.", "Current = power ÷ voltage.", "You can also use power = I² × R, or V² ÷ R, when the resistance is known."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const V = pick(r, [6, 12, 24, 110, 220, 230]), I = ri(r, 1, 6);
          return { q: `A device runs on ${V} V and draws ${I} A. What is its power? (in W)`, direct: rat(V * I), short: mul(rat(V), rat(I)), how: `P = V × I = ${V} × ${I} = ${V * I} W.` };
        }
        if (level === 2) {
          const V = pick(r, [110, 220, 230]), I = ri(r, 1, 8);
          return { q: `A heater of ${V * I} W works on ${V} V. What current does it draw? (in A)`, direct: rat(V * I, V), short: rat(I), how: `I = P ÷ V = ${V * I} ÷ ${V} = ${I} A.` };
        }
        if (level === 3) {
          const V = pick(r, [6, 12, 24, 110, 220]), I = ri(r, 1, 6);
          return { q: `A lamp of ${V * I} W draws ${I} A. What voltage does it need? (in V)`, direct: rat(V * I, I), short: rat(V), how: `V = P ÷ I = ${V * I} ÷ ${I} = ${V} V.` };
        }
        if (level === 4) {
          const V = pick(r, [6, 12, 24, 110, 220, 230]), I = pick(r, [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]), P = V * I;
          if (!Number.isInteger(P)) throw RETRY;
          return { q: `A bulb marked ${P} W, ${V} V is used on a ${V} V supply. What current does it draw? (in A)`, direct: rat(P, V), short: mul(rat(P), rat(1, V)), how: `I = P ÷ V = ${P} ÷ ${V} = ${fmt(rat(P, V))} A.` };
        }
        if (level === 5) {
          const I = ri(r, 2, 10), R = ri(r, 2, 20);
          return { q: `A current of ${I} A flows through a ${R} Ω heating coil. What power does it use? (in W)`, direct: mul(rat(I * I), rat(R)), short: mul(rat(I * R), rat(I)), how: `P = I² × R = ${I * I} × ${R} = ${I * I * R} W.` };
        }
        if (level === 6) {
          const V = pick(r, [12, 24, 60, 100, 120, 220]), R = pick(r, [4, 5, 8, 10, 20, 24, 40]);
          return { q: `A ${R} Ω heater is connected to ${V} V. What power does it use? (in W)`, direct: mul(rat(V), rat(V, R)), short: rat(V * V, R), how: `Current ${V} ÷ ${R} = ${fmt(rat(V, R))} A. P = V × I = ${fmt(rat(V * V, R))} W, or V² ÷ R.` };
        }
        if (level === 7) {
          const P1 = 55 * ri(r, 1, 8), P2 = 110 * ri(r, 2, 20);
          return { q: `A ${P1} W bulb and a ${P2} W heater run together on 220 V. What total current do they draw? (in A)`, direct: rat(P1 + P2, 220), short: add(rat(P1, 220), rat(P2, 220)), how: `Total power ${P1} + ${P2} = ${P1 + P2} W. I = ${P1 + P2} ÷ 220 = ${fmt(rat(P1 + P2, 220))} A.` };
        }
        const P = pick(r, [440, 880, 1100, 1650, 2200]), fuse = 5 * ri(r, 1, 5);
        return { q: `A ${fuse} A fuse is fitted on a 220 V line. How many ${P} W heaters can run at once without the fuse blowing? (whole number)`, direct: rat(Math.floor((fuse * 220) / P)), short: rat(Math.floor(fuse / (P / 220))), how: `The fuse allows ${fuse} × 220 = ${fuse * 220} W. Each heater uses ${P} W. ${fuse * 220} ÷ ${P} = ${fmt(rat(fuse * 220, P))}, so ${Math.floor((fuse * 220) / P)} heaters.` };
      });
    },
  },
  {
    id: "el-energy",
    topic: "electricity",
    title: "Units of electricity (kWh)",
    when: "Electricity bills: power, hours and cost per unit.",
    steps: ["Energy in kWh (units) = power in kilowatts × hours.", "Turn watts into kilowatts first: ÷ 1000.", "Cost = units × price per unit."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const kw = ri(r, 1, 5), h = ri(r, 2, 10);
          return { q: `A ${kw} kW heater runs for ${h} hours. How many units (kWh) does it use?`, direct: rat(kw * h), short: mul(rat(kw), rat(h)), how: `${kw} × ${h} = ${kw * h} units.` };
        }
        if (level === 2) {
          const w = pick(r, [100, 200, 500, 1000, 1500, 2000]), h = ri(r, 2, 10);
          return { q: `A ${w} W appliance runs for ${h} hours. How many units does it use?`, direct: mul(rat(w, 1000), rat(h)), short: rat(w * h, 1000), how: `${w} W = ${fmt(rat(w, 1000))} kW. × ${h} h = ${fmt(rat(w * h, 1000))} units.` };
        }
        if (level === 3) {
          const w = pick(r, [40, 60, 100, 500, 1000]), h = ri(r, 2, 12), n = ri(r, 2, 8);
          return { q: `${n} bulbs of ${w} W each burn for ${h} hours. How many units do they use?`, direct: mul(rat(n * w, 1000), rat(h)), short: rat(n * w * h, 1000), how: `${n} × ${w} = ${n * w} W = ${fmt(rat(n * w, 1000))} kW. × ${h} h = ${fmt(rat(n * w * h, 1000))} units.` };
        }
        if (level === 4) {
          const kw = ri(r, 1, 3), h = ri(r, 2, 8), rate = pick(r, [5, 6, 7, 8, 10]);
          return { q: `A ${kw} kW geyser runs for ${h} hours. One unit costs ₹${rate}. What is the cost? (in ₹)`, direct: mul(rat(kw * h), rat(rate)), short: rat(kw * h * rate), how: `Units: ${kw} × ${h} = ${kw * h}. Cost: ${kw * h} × ${rate} = ${kw * h * rate} rupees.` };
        }
        if (level === 5) {
          const w = pick(r, [100, 200, 500, 1000, 2000]), h = ri(r, 1, 6), rate = pick(r, [5, 6, 8, 10]);
          return { q: `A ${w} W appliance runs ${h} hours every day for 30 days. One unit costs ₹${rate}. What is the bill for the month? (in ₹)`, direct: mul(mul(rat(w, 1000), rat(h * 30)), rat(rate)), short: rat(w * h * 30 * rate, 1000), how: `Per day: ${w} W × ${h} h = ${fmt(rat(w * h, 1000))} units. 30 days: ${fmt(rat(w * h * 30, 1000))} units. × ₹${rate} = ₹${fmt(rat(w * h * 30 * rate, 1000))}.` };
        }
        if (level === 6) {
          const w = pick(r, [500, 1000, 1500, 2000]), mn = pick(r, [30, 45, 60, 90, 120]);
          return { q: `A ${w} W iron is used for ${mn} minutes. How many units does it use?`, direct: mul(rat(w, 1000), rat(mn, 60)), short: rat(w * mn, 60000), how: `${mn} minutes = ${fmt(rat(mn, 60))} h. ${fmt(rat(w, 1000))} kW × ${fmt(rat(mn, 60))} h = ${fmt(rat(w * mn, 60000))} units.` };
        }
        if (level === 7) {
          const w1 = pick(r, [60, 100, 150]), w2 = pick(r, [1000, 1500, 2000]), h1 = ri(r, 4, 10), h2 = ri(r, 1, 4), rate = pick(r, [5, 6, 8, 10]);
          return { q: `A ${w1} W fan runs ${h1} h and a ${w2} W heater runs ${h2} h each day. One unit costs ₹${rate}. What is the cost for one day? (in ₹)`, direct: mul(add(rat(w1 * h1, 1000), rat(w2 * h2, 1000)), rat(rate)), short: rat((w1 * h1 + w2 * h2) * rate, 1000), how: `Fan: ${fmt(rat(w1 * h1, 1000))} units. Heater: ${fmt(rat(w2 * h2, 1000))} units. Together ${fmt(rat(w1 * h1 + w2 * h2, 1000))} units × ₹${rate} = ₹${fmt(rat((w1 * h1 + w2 * h2) * rate, 1000))}.` };
        }
        const kw = ri(r, 1, 5), h = ri(r, 1, 6);
        return { q: `A ${kw} kW heater runs for ${h} hours. 1 unit (1 kWh) is 3 600 000 J. How much energy is used? (in millions of joules, MJ)`, direct: mul(rat(kw * 1000 * h * 3600), rat(1, 1000000)), short: mul(rat(kw * h), rat(36, 10)), how: `Units: ${kw} × ${h} = ${kw * h} kWh. × 3.6 MJ = ${fmt(mul(rat(kw * h), rat(36, 10)))} MJ.` };
      });
    },
  },
  {
    id: "el-heat",
    topic: "electricity",
    title: "Heating effect: H = I² × R × t",
    when: "How much heat a wire or heater gives out.",
    steps: ["Heat in joules H = I² × R × t (current squared × resistance × seconds).", "Or H = V × I × t, or power × time.", "Keep the time in seconds. 1 minute = 60 s."],
    make(level, r) {
      return phys(r, () => {
        if (level === 1) {
          const I = ri(r, 1, 5), R = ri(r, 2, 10), t = ri(r, 2, 10);
          return { q: `A current of ${I} A flows through a ${R} Ω wire for ${t} s. How much heat is produced? (in J)`, direct: rat(I * I * R * t), short: mul(rat(I * R), rat(I * t)), how: `H = I² × R × t = ${I * I} × ${R} × ${t} = ${I * I * R * t} J.` };
        }
        if (level === 2) {
          const V = pick(r, [6, 12, 24, 100, 220]), I = ri(r, 1, 6), t = ri(r, 2, 20);
          return { q: `A ${V} V supply sends ${I} A through a heater for ${t} s. How much heat is produced? (in J)`, direct: rat(V * I * t), short: mul(rat(V * I), rat(t)), how: `H = V × I × t = ${V} × ${I} × ${t} = ${V * I * t} J.` };
        }
        if (level === 3) {
          const I = ri(r, 2, 8), R = ri(r, 5, 30), t = ri(r, 5, 40);
          return { q: `A coil of ${R} Ω carries ${I} A for ${t} s. How much heat does it give out? (in J)`, direct: rat(I * I * R * t), short: mul(rat(I * I), rat(R * t)), how: `${I}² = ${I * I}. ${I * I} × ${R} × ${t} = ${I * I * R * t} J.` };
        }
        if (level === 4) {
          const I = ri(r, 2, 6), R = ri(r, 5, 20), mn = ri(r, 1, 5);
          return { q: `A ${R} Ω element carries ${I} A for ${mn} minutes. How much heat is produced? (in J)`, direct: rat(I * I * R * mn * 60), short: mul(rat(I * I * R), rat(mn * 60)), how: `${mn} min = ${mn * 60} s. ${I * I} × ${R} × ${mn * 60} = ${I * I * R * mn * 60} J.` };
        }
        if (level === 5) {
          const I = ri(r, 2, 9), R = ri(r, 2, 12), t = ri(r, 5, 30);
          const H = I * I * R * t;
          return { q: `A ${R} Ω resistor gives out ${H} J of heat in ${t} s. What current flows through it? (in A)`, direct: rat(Math.round(Math.sqrt(H / (R * t)))), short: rat(I), how: `I² = H ÷ (R × t) = ${H} ÷ ${R * t} = ${I * I}. So I = ${I} A.` };
        }
        if (level === 6) {
          const I = ri(r, 2, 8), R = ri(r, 5, 25), mn = ri(r, 1, 6);
          return { q: `A ${R} Ω heater carries ${I} A for ${mn} minutes. How much heat is produced? (in kJ)`, direct: mul(rat(I * I * R * mn * 60), rat(1, 1000)), short: rat(I * I * R * mn * 6, 100), how: `${I * I * R} W for ${mn * 60} s = ${I * I * R * mn * 60} J = ${fmt(rat(I * I * R * mn * 60, 1000))} kJ.` };
        }
        if (level === 7) {
          const H = 1000 * ri(r, 2, 60), t = 10 * ri(r, 1, 12);
          return { q: `A heater gives out ${H} J in ${t} s. What is its power? (in W)`, direct: rat(H, t), short: rat(H, t), how: `Power = energy ÷ time = ${H} ÷ ${t} = ${fmt(rat(H, t))} W.` };
        }
        const m = ri(r, 1, 4), P = 100 * ri(r, 4, 20), t = 60 * ri(r, 5, 20), dT = (P * t) / (m * 4200);
        if (!Number.isInteger(dT * 10)) throw RETRY;
        return { q: `A ${P} W heater warms ${m} kg of water for ${t / 60} minutes. All the heat goes into the water. Water needs 4200 J to warm 1 kg by 1 °C. By how many °C does the water warm?`, direct: rat(P * t, m * 4200), short: mul(rat(P * t), rat(1, m * 4200)), how: `Heat = ${P} × ${t} = ${P * t} J. Rise = ${P * t} ÷ (${m} × 4200) = ${fmt(rat(P * t, m * 4200))} °C.` };
      });
    },
  },
];

export const cardsFor = (topic: TopicId) => CARDS.filter((c) => c.topic === topic);
export const cardById = (id: string) => CARDS.find((c) => c.id === id);
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

// The worked example on a card: its own question maker at the easiest level with a fixed seed, so it is always correct.
export function exampleFor(card: Card): Made {
  let h = 7;
  for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return card.make(1, seeded(h));
}
