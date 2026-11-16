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

export type TopicId = "percentages" | "ratio" | "multiplication" | "division" | "profit-loss" | "probability";
export type Level = 1 | 2 | 3;
export type Made = { q: string; a: string; how: string; direct: Rat; short: Rat };
export type Card = {
  id: string;
  topic: TopicId;
  title: string;
  when: string;
  steps: string[];
  make: (level: Level, r: Rnd) => Made;
};

export const TOPICS: { id: TopicId; label: string; line: string; targetMs: number }[] = [
  { id: "percentages", label: "Percentages", line: "Find a percent of a number without long working.", targetMs: 30_000 },
  { id: "ratio", label: "Ratio and proportion", line: "Share amounts, scale up and down, and work with direct and inverse change.", targetMs: 40_000 },
  { id: "multiplication", label: "Multiplication", line: "Squares, times 11, numbers near 100 and round-number tricks.", targetMs: 25_000 },
  { id: "division", label: "Division", line: "Divide by 5, 25, 125 and by breaking the divisor.", targetMs: 25_000 },
  { id: "profit-loss", label: "Profit and loss", line: "Selling price and cost price with percent changes.", targetMs: 40_000 },
  { id: "probability", label: "Probability", line: "Dice, bags of balls, and counting outcomes quickly.", targetMs: 30_000 },
];

const dieSet = [1, 2, 3, 4, 5, 6];
const isPrime = (x: number) => x > 1 && Array.from({ length: x - 2 }, (_, i) => i + 2).every((d) => x % d !== 0);
const twoDice: [number, number][] = dieSet.flatMap((a) => dieSet.map((b) => [a, b] as [number, number]));
const countDie = (f: (x: number) => boolean) => dieSet.filter(f).length;
const countTwo = (f: (a: number, b: number) => boolean) => twoDice.filter(([a, b]) => f(a, b)).length;

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
      const n = 20 * (level === 1 ? ri(r, 2, 15) : level === 2 ? ri(r, 10, 40) : ri(r, 25, 90));
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
      const a = 4 * (level === 1 ? ri(r, 1, 5) : level === 2 ? ri(r, 3, 12) : ri(r, 8, 25));
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
      const n = den * (level === 1 ? ri(r, 2, 12) : level === 2 ? ri(r, 3, 25) : ri(r, 5, 60));
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
      const xs = [ri(r, 1, 9), ri(r, 1, 9), ri(r, 1, 9)];
      if (new Set(xs).size < 2) xs[1] = (xs[0] % 9) + 1;
      const sum = xs[0] + xs[1] + xs[2];
      const u = 5 * ri(r, 2, 24);
      const T = u * sum;
      const hi = Math.max(...xs);
      const lo = Math.min(...xs);
      const direct = rat(T * (hi - lo), sum);
      const short = mul(rat(T, sum), rat(hi - lo));
      return { q: `${money(T)} is shared among three people in the ratio ${xs.join(" : ")}. How much more does the largest share get than the smallest? (in ₹)`, a: fmt(direct), direct, short, how: `${xs.join(" + ")} = ${sum} parts. ${T} ÷ ${sum} = ${u} a part. Largest minus smallest is ${hi} − ${lo} = ${hi - lo} parts, so ${u} × ${hi - lo} = ${fmt(direct)}.` };
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
        p = ri(r, 1, level === 1 ? 5 : 9);
        q = ri(r, 1, level === 1 ? 5 : 9);
      } while (p === q || gcd(p, q) !== 1);
      const g = level === 1 ? ri(r, 2, 6) : level === 2 ? ri(r, 2, 9) : ri(r, 3, 14);
      const h = level === 1 ? ri(r, 2, 9) : level === 2 ? ri(r, 2, 15) : ri(r, 3, 25);
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
      const Ts = [24, 36, 48, 60, 72, 90, 120, 180, 240, 360];
      for (let tries = 0; tries < 60; tries++) {
        const T = pick(r, level === 1 ? Ts.slice(0, 5) : Ts);
        const divs = Array.from({ length: T }, (_, i) => i + 1).filter((x) => T % x === 0 && x >= 2 && x <= 40);
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
      const n = level === 1 ? ri(r, 12, 99) : level === 2 ? ri(r, 100, 999) : ri(r, 1000, 9999);
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
      const n = level === 1 ? ri(r, 1, 9) : level === 2 ? ri(r, 10, 19) : ri(r, 20, 99);
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
      const gap = () => (level === 1 ? -ri(r, 1, 9) : level === 2 ? -ri(r, 1, 20) : pick(r, [-1, 1]) * ri(r, 1, 15));
      const d1 = gap();
      const d2 = gap();
      const [a, b] = [100 + d1, 100 + d2];
      const front = 100 + d1 + d2;
      const back = d1 * d2;
      const direct = rat(a * b);
      const short = rat(front * 100 + back);
      const sg = (x: number) => (x < 0 ? `−${-x}` : `+${x}`);
      return { q: `${a} × ${b}`, a: fmt(direct), direct, short, how: `Gaps from 100: ${sg(d1)} and ${sg(d2)}. Front: 100 ${sg(d1)} ${sg(d2)} = ${front}. Back: ${d1} × ${d2} = ${back}. ${front * 100} ${back < 0 ? "−" : "+"} ${Math.abs(back)} = ${fmt(direct)}.` };
    },
  },
  {
    id: "mu-mid",
    topic: "multiplication",
    title: "Straddle a round number",
    when: "The two numbers sit the same distance either side of a round number, like 47 × 53.",
    steps: ["Find the middle number (47 and 53 are both 3 away from 50).", "Square the middle (50² = 2500).", "Subtract the square of the distance (3² = 9). 2500 − 9 = 2491."],
    make(level, r) {
      const m = level === 1 ? pick(r, [20, 30, 40, 50, 60]) : level === 2 ? 5 * ri(r, 5, 19) : 10 * ri(r, 10, 20);
      const d = level === 1 ? ri(r, 1, 5) : level === 2 ? ri(r, 1, 9) : ri(r, 1, 15);
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
      const all: [number, number, number][] = [[5, 10, 2], [25, 100, 4], [50, 100, 2], [125, 1000, 8]];
      const [m, K, D] = pick(r, level === 1 ? [all[0], all[2]] : level === 2 ? [all[0], all[1], all[2]] : [all[1], all[3], all[2]]);
      const n = level === 1 ? ri(r, 12, 98) : level === 2 ? ri(r, 24, 350) : ri(r, 36, 999);
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
      const all: [number, number, number][] = [[5, 2, 10], [25, 4, 100], [50, 2, 100], [125, 8, 1000]];
      const [m, K, D] = pick(r, level === 1 ? [all[0], all[2]] : level === 2 ? [all[0], all[1], all[2]] : [all[1], all[3]]);
      const n = level === 1 ? ri(r, 20, 199) : level === 2 ? ri(r, 30, 899) : ri(r, 100, 9999);
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
      const all: [number, number, number][] = [[6, 2, 3], [12, 3, 4], [15, 3, 5], [14, 2, 7], [18, 2, 9], [24, 4, 6], [45, 5, 9], [36, 6, 6]];
      const [m, a, b] = pick(r, level === 1 ? all.slice(0, 3) : level === 2 ? all.slice(0, 6) : all);
      const n = m * (level === 1 ? ri(r, 3, 15) : level === 2 ? ri(r, 5, 35) : ri(r, 8, 60));
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
      const ps = level === 1 ? [10, 20, 25, 50] : [5, 10, 15, 20, 25, 30, 35, 40, 50, 60];
      const p = pick(r, ps);
      const CP = 20 * (level === 1 ? ri(r, 3, 30) : level === 2 ? ri(r, 5, 60) : ri(r, 10, 120));
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
      const ps = level === 1 ? [10, 20, 25, 50] : [5, 10, 15, 20, 25, 30, 40, 50];
      const p = pick(r, ps);
      const g = gcd(p, 100);
      const n = p / g;
      const d = 100 / g;
      const profit = ri(r, 0, 1) === 0;
      const k = level === 1 ? ri(r, 2, 12) : level === 2 ? ri(r, 3, 30) : ri(r, 5, 80);
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
    steps: ["Check the two outcomes cannot happen together (no overlap).", "Find each probability.", "Add them."],
    make(level, r) {
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
