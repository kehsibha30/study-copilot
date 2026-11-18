import { z } from "zod";
import type { Picture } from "./store";

// Lesson pictures (decision 7R, 18 Nov 2026). The AI picks one of four hand-built animations and fills a few
// labels and numbers. Anything that does not fit is dropped here and the lesson stays text.

export const PictureAsk = z.object({
  template: z.enum(["heating", "depth", "expand", "cube", "none"]),
  // heating
  thing: z.string(),
  start: z.number(),
  boil: z.number(),
  // depth
  medium: z.enum(["water", "air", "none"]),
  // expand
  cold: z.string(),
  hot: z.string(),
  // cube: six labels, 0+1, 2+3 and 4+5 are opposite pairs
  faces: z.array(z.string()),
});

export type PictureAskType = z.infer<typeof PictureAsk>;

// Plain, short, no markup. Returns null when the text is not usable.
function label(raw: string, max: number): string | null {
  const text = raw.replace(/[<>{}\n\r]/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 1 && text.length <= max ? text : null;
}

export function cleanPicture(ask: PictureAskType): Picture | null {
  if (ask.template === "heating") {
    const thing = label(ask.thing, 24);
    if (!thing || !Number.isFinite(ask.start) || !Number.isFinite(ask.boil)) return null;
    if (ask.boil < 40 || ask.boil > 400 || ask.start < -20 || ask.start > ask.boil - 20) return null;
    return { template: "heating", thing, start: Math.round(ask.start), boil: Math.round(ask.boil) };
  }
  if (ask.template === "depth") {
    return ask.medium === "water" || ask.medium === "air" ? { template: "depth", medium: ask.medium } : null;
  }
  if (ask.template === "expand") {
    const thing = label(ask.thing, 24);
    const cold = label(ask.cold, 14);
    const hot = label(ask.hot, 14);
    return thing && cold && hot ? { template: "expand", thing, cold, hot } : null;
  }
  if (ask.template === "cube") {
    if (ask.faces.length !== 6) return null;
    const faces = ask.faces.map((f) => label(f, 8));
    if (faces.some((f) => f === null) || new Set(faces).size !== 6) return null;
    return { template: "cube", faces: faces as [string, string, string, string, string, string] };
  }
  return null;
}

// What the picture says, in words, so a second solve that cannot see it can check it.
export function describePicture(p: Picture): string {
  if (p.template === "heating")
    return `An animation of ${p.thing} on a stove. A graph of temperature against time rises from ${p.start} °C to ${p.boil} °C, then goes flat at ${p.boil} °C while it boils and makes steam.`;
  if (p.template === "depth")
    return p.medium === "water"
      ? "An animation of a gauge going down through water. The pressure bar gets longer the deeper it goes, because more water is above it."
      : "An animation of a gauge going down through air (for example into a mine). The pressure bar gets longer the lower it goes, because more air is above it.";
  if (p.template === "expand")
    return `An animation of ${p.thing}. When it is heated from ${p.cold} to ${p.hot} the same amount of it spreads out and takes more space, so its density goes down. When it is cooled it packs closer together and its density goes up.`;
  const [a, b, c, d, e, f] = p.faces;
  return `An animation of a cube turning. It highlights pairs of faces that are opposite each other: ${a} is opposite ${b}, ${c} is opposite ${d}, and ${e} is opposite ${f}.`;
}
