import { SceneComposition, ScenePainter, ScenePalette } from './types';
import { paintSky } from './sky';
import { paintNight } from './night';
import { paintLantern } from './lantern';
import { paintGarden } from './garden';
import { paintDust } from './dust';
import { paintEmber } from './ember';
import { paintPaper } from './paper';

/**
 * The registry: which world each theme lives in, and how each section shapes
 * it.
 *
 * The first attempt at "a background per theme per section" drew one set of
 * gradients and recoloured it, which the owner correctly called out: Sakinah
 * Blue's dashboard should be a SKY, and the library in that same theme should
 * be the same sky seen differently — not the same blob with a different tint.
 *
 * So the two axes are genuinely different things. The THEME picks the painter
 * — an actual world, painted with its own physics: cloud banks, star fields,
 * lamp light, vines, dust in shafts, embers, laid paper. The SECTION picks the
 * composition — where the horizon sits, where the light is, how much is in the
 * air, how fast it moves. Seven painters x nine compositions, and a theme bias
 * on top, gives every one of the ninety combinations its own frame.
 */

/** Which world a theme lives in. */
const THEME_SCENE: Record<string, ScenePainter> = {
  blue: paintSky,
  samaa: paintSky,
  onyx: paintNight,
  mushaf: paintLantern,
  'mushaf-gold': paintLantern,
  maktabah: paintLantern,
  emerald: paintGarden,
  noor: paintDust,
  red: paintEmber,
  pearl: paintPaper,
};

/**
 * Theme character within a shared painter. Three themes share the lantern and
 * two share the sky; without this they would be the same picture in different
 * inks, which is exactly the failure being corrected.
 *
 *   blue         a full cumulus sky, light high and central
 *   samaa        thin high cirrus, open air, light off to one side
 *   mushaf       one low lamp, sparse air — a small room at night
 *   mushaf-gold  an illuminated page: dense, bright, light high
 *   maktabah     a wide reading room, lamp to the side, quiet air
 */
const THEME_BIAS: Record<string, Partial<SceneComposition>> = {
  blue: { density: 0.78, focusX: 0.54, focusY: 0.1 },
  samaa: { density: 0.34, focusX: 0.2, focusY: 0.16, speed: 1.25 },
  mushaf: { density: 0.5, focusX: 0.28, focusY: 0.62, speed: 0.75 },
  'mushaf-gold': { density: 0.9, focusX: 0.5, focusY: 0.2 },
  maktabah: { density: 0.4, focusX: 0.78, focusY: 0.4, speed: 0.85 },
};

/**
 * How each section composes its theme's world. These are the same five numbers
 * the CSS light layer answers to, so the painted scene and the CSS glow agree
 * about where the light in a given section comes from.
 */
const SECTION_COMP: Record<string, SceneComposition> = {
  /* The landing: the widest view, light high and central, the world at full
     strength. Everything else is a quieter version of this. */
  dashboard: { horizon: 0.72, focusX: 0.5, focusY: 0.08, density: 1, speed: 1, weight: 1 },
  /* Shelf height: the horizon rises so the world sits behind the stacks, and
     the light comes from the reading side. */
  library: { horizon: 0.52, focusX: 0.14, focusY: 0.14, density: 0.85, speed: 0.85, weight: 0.95 },
  /* A screening room: the light is a single high source and the floor falls
     away, so the horizon is low and the air is thin. */
  watch: { horizon: 0.84, focusX: 0.5, focusY: 0.03, density: 0.55, speed: 0.7, weight: 0.85 },
  /* Broadcast: light off to the side and the fastest air in the app — this is
     the one section that is meant to feel like it is transmitting. */
  radio: { horizon: 0.58, focusX: 0.86, focusY: 0.3, density: 0.8, speed: 1.15, weight: 0.9 },
  /* Before dawn: a high horizon and the light just breaking at one edge. */
  reminders: { horizon: 0.42, focusX: 0.78, focusY: 0.06, density: 0.7, speed: 0.8, weight: 0.95 },
  /* The work happens low, so the world is pushed down and lit from below. */
  downloads: { horizon: 0.9, focusX: 0.5, focusY: 0.94, density: 0.6, speed: 0.75, weight: 0.9 },
  /* A utility room: the least air, the slowest movement, light in a corner. */
  settings: { horizon: 0.66, focusX: 0.9, focusY: 0.86, density: 0.42, speed: 0.6, weight: 0.78 },
  /* The mushaf. speed 0 is LOAD-BEARING, not a taste decision: motion behind
     Qur'anic text is forbidden, so the world is painted and then frozen. The
     tier resolver also refuses to run the canvas on this route at all; this is
     the second of the two independent guarantees. */
  quran: { horizon: 0.5, focusX: 0.5, focusY: 0.12, density: 0.45, speed: 0, weight: 0.7 },
  /* The player dims the room so nothing competes with the picture. */
  player: { horizon: 0.5, focusX: 0.5, focusY: 0.5, density: 0.28, speed: 0.4, weight: 0.5 },
};

const FALLBACK_COMP = SECTION_COMP.dashboard;

export const painterFor = (theme: string): ScenePainter => THEME_SCENE[theme] ?? paintDust;

export const compositionFor = (theme: string, section: string): SceneComposition => ({
  ...(SECTION_COMP[section] ?? FALLBACK_COMP),
  ...(THEME_BIAS[theme] ?? {}),
  /* The section always wins on speed and weight: a theme may say "my world is
     busy", but only the section knows whether this page can afford motion. A
     theme bias that could raise speed on /quran would be a manhaj bug. */
  speed:
    (SECTION_COMP[section] ?? FALLBACK_COMP).speed *
    (THEME_BIAS[theme]?.speed ?? 1),
  weight: (SECTION_COMP[section] ?? FALLBACK_COMP).weight,
});

/** Reads the live theme tokens. Called once per scene start, never per frame. */
export const readPalette = (): ScenePalette => {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    root.getPropertyValue(name).trim() || fallback;
  return {
    accent: token('--accent-gold-rgb', '236 195 102'),
    soft: token('--text-soft-rgb', '215 221 232'),
    green: token('--quran-green-rgb', '54 199 124'),
    teal: token('--accent-teal-rgb', '23 178 163'),
    turquoise: token('--accent-turquoise-rgb', '46 196 182'),
    shade: token('--shade-rgb', '0 0 0'),
    sheen: token('--sheen-rgb', '255 255 255'),
    ground: token('--bg-main-rgb', '10 20 32'),
  };
};

export type { SceneComposition, ScenePainter, ScenePalette } from './types';
