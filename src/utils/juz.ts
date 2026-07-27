/**
 * Juz boundaries, for the Hafs (Kufan) numbering only.
 *
 * The thirty juz start points are a fixed, universally agreed table addressed
 * as surah:ayah. They are agreed *in the Kufan numbering* — and this app also
 * ships Warsh, whose Madani numbering genuinely differs: 50 of the 114 surahs
 * carry a different ayah count (6236 ayat in Hafs against 6214 in Warsh, both
 * measured from the bundled data). Applying this table to a Warsh position
 * would silently report the wrong juz.
 *
 * So `juzFor` takes the riwayah and returns null for Warsh rather than
 * guessing. The reading header shows surah and ayah in both riwayat and adds
 * the juz only where the app can state it correctly. A missing figure is a
 * smaller failure than a confidently wrong one, and this is Qur'anic
 * reference data.
 *
 * If verified Warsh juz boundaries are added later, this is the single place
 * that needs to change.
 */

/** [surah, ayah] at which each juz begins, juz 1 first. Kufan numbering. */
const JUZ_START_HAFS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 142], [2, 253], [3, 92], [4, 24], [4, 148],
  [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6],
  [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1],
  [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export type Riwayah = 'hafs' | 'warsh';

/**
 * The juz containing a position, or null when it cannot be stated correctly.
 *
 * Returns null for Warsh (see the module docblock) and for any position that
 * precedes the start of the table, which should be unreachable.
 */
export function juzFor(
  riwayah: Riwayah,
  surahId: number,
  ayahId: number,
): number | null {
  if (riwayah !== 'hafs') return null;
  if (!Number.isFinite(surahId) || !Number.isFinite(ayahId)) return null;

  // Walk backwards to the last boundary at or before this position. Thirty
  // entries — a linear scan is clearer than a binary search and costs nothing.
  for (let i = JUZ_START_HAFS.length - 1; i >= 0; i -= 1) {
    const [s, a] = JUZ_START_HAFS[i];
    if (surahId > s || (surahId === s && ayahId >= a)) return i + 1;
  }
  return null;
}
