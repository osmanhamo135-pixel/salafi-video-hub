/**
 * The scene contract.
 *
 * A scene is a PAINTED WORLD, not an icon. Each theme owns one — a sky, a
 * garden, a lantern-lit room — and each section shapes it through a
 * composition: where the horizon sits, where the light is, how busy the air
 * is, how fast it moves. Ten themes x nine sections come out of seven
 * painters and one composition table, and no two look the same.
 *
 * Every scene is a pure function of (time, palette, composition). No state,
 * no DOM, no images: the whole thing is drawn with canvas primitives so the
 * app ships no photograph and no generated raster, and so every colour comes
 * from the active theme's own tokens.
 *
 * NON-NEGOTIABLE, and true of every scene in this folder:
 *   - No depiction of any animate being. No people, faces, animals, birds,
 *     silhouettes of them, or anything that reads as one. Skies carry cloud
 *     and light; gardens carry leaf and vine; nothing that breathes.
 *   - Colour comes only from `palette`, which is read from the theme's CSS
 *     custom properties. A scene must never hard-code a hue.
 *   - Drawn at 30fps into a small backing canvas that is upscaled, so the
 *     budget per frame is a few hundred primitives, not a few thousand.
 *   - Nothing may be drawn that competes with reading. Scenes are the room,
 *     not the page.
 */

/** Theme colours, as space-separated "R G B" triples ready for rgb(). */
export interface ScenePalette {
  accent: string;
  soft: string;
  green: string;
  teal: string;
  turquoise: string;
  shade: string;
  sheen: string;
  /** The theme's own page ground, for scenes that need to sink into it. */
  ground: string;
}

/**
 * How a section shapes the theme's world. The same sky becomes a dashboard's
 * wide horizon, a library's low band behind shelves, or a settings page's
 * quiet corner, purely through these five numbers.
 */
export interface SceneComposition {
  /** 0 = top of frame, 1 = bottom. Where the world's ground line sits. */
  horizon: number;
  /** Focal point of the scene's light, 0..1 of width/height. */
  focusX: number;
  focusY: number;
  /** 0..1 — how much matter is in the air. */
  density: number;
  /** Multiplier on every drift speed in the scene. 0 means a still world. */
  speed: number;
  /** Overall opacity multiplier applied by the caller's `level`. */
  weight: number;
}

export interface SceneFrame {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Seconds since the scene started, monotonically increasing. */
  t: number;
  /** 0..1 master intensity: motion preference x route dim. */
  level: number;
  palette: ScenePalette;
  comp: SceneComposition;
  /** Deterministic pseudo-random in [0,1). Same (i, salt) always agrees. */
  rnd: (i: number, salt: number) => number;
}

export type ScenePainter = (f: SceneFrame) => void;

/** Deterministic per-index pseudo-random so a remount paints the same world. */
export const rnd = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** `rgb(r g b / a)` from a palette triple. Clamps so callers can be sloppy. */
export const rgba = (triple: string, alpha: number): string =>
  `rgb(${triple} / ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
