/**
 * Outline fallback for engines that will not place the harakat.
 *
 * WebKitGTK 2.46+ shapes the ayah correctly and then paints every mark that
 * GPOS lifts at the baseline instead, where it vanishes into the letterforms.
 * See `checkHarakat` in mushafFont.ts for the detection and CLAUDE.md for the
 * proof. When that is what the reader's engine does, the page stops asking it
 * to lay out Qur'anic text and asks it only to fill outlines that were shaped
 * out in Rust, by HarfBuzz, from the Complex's own face.
 *
 * The transport sends each GLYPH once and places it by reference. Whole-word
 * paths measure ~19 MB for al-Baqarah alone; per-glyph, the total is bounded by
 * the face — roughly 1400 outlines — however much is read.
 */
import { invoke } from '@tauri-apps/api/core';

export interface GlyphOutline {
  id: number;
  d: string;
}

export interface Placement {
  g: number;
  x: number;
  y: number;
}

export interface ShapedWord {
  p: Placement[];
  width: number;
  ascent: number;
  descent: number;
}

interface ShapeBatch {
  upem: number;
  glyphs: GlyphOutline[];
  words: (ShapedWord | null)[];
}

export interface OutlineSet {
  upem: number;
  /** Every glyph seen so far, for the page to emit once into a <defs>. */
  glyphs: GlyphOutline[];
  /** Word text -> its placements. A word missing here keeps its normal text. */
  words: Map<string, ShapedWord>;
}

/* Kept per riwayah and for the life of the window. The two readings must never
   share: a Warsh word shaped against the Hafs face would be the wrong
   letterforms for the reading on screen. */
interface RiwayahStore {
  upem: number;
  glyphs: Map<number, string>;
  words: Map<string, ShapedWord>;
}

const stores: Record<'hafs' | 'warsh', RiwayahStore> = {
  hafs: { upem: 0, glyphs: new Map(), words: new Map() },
  warsh: { upem: 0, glyphs: new Map(), words: new Map() },
};

/* Long surahs are requested in slices so the first screenful can paint while
   the rest is still coming, and so no single message carries a whole juz'. */
const BATCH = 400;

/**
 * Shape every word given, reusing anything already shaped in this window.
 * Returns the accumulated set, so callers can render straight from it.
 */
export async function loadOutlines(warsh: boolean, words: string[]): Promise<OutlineSet> {
  const store = stores[warsh ? 'warsh' : 'hafs'];

  const pending: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (!word || store.words.has(word) || seen.has(word)) continue;
    seen.add(word);
    pending.push(word);
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const batch = await invoke<ShapeBatch>('shape_mushaf_words', {
      warsh,
      words: slice,
      // Tell the backend what this window already holds so a glyph is never
      // sent twice; on a second surah this is most of them.
      knownGlyphs: Array.from(store.glyphs.keys()),
    });
    store.upem = batch.upem;
    for (const glyph of batch.glyphs) store.glyphs.set(glyph.id, glyph.d);
    slice.forEach((word, index) => {
      const shaped = batch.words[index];
      if (shaped) store.words.set(word, shaped);
    });
  }

  return snapshot(store);
}

function snapshot(store: RiwayahStore): OutlineSet {
  return {
    upem: store.upem,
    glyphs: Array.from(store.glyphs, ([id, d]) => ({ id, d })),
    words: store.words,
  };
}

/** What is already known, without asking the backend for anything. */
export function currentOutlines(warsh: boolean): OutlineSet {
  return snapshot(stores[warsh ? 'warsh' : 'hafs']);
}
