export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Short duration, e.g. `2h 30m` / `٢ س ٣٠ د`.
 *
 * Localised because the units were previously hardcoded English and showed as
 * "30m" inside otherwise-Arabic copy, and isolated (U+2066 … U+2069) because a
 * number followed by a unit is reordered by the bidi algorithm in an RTL
 * paragraph.
 */
export function formatDuration(seconds: number, language: 'en' | 'ar' = 'en'): string {
  // The isolate has to match the units' own direction. Wrapping Arabic units in
  // a LEFT-to-right isolate (U+2066) forces the Arabic runs into LTR order, so
  // "1س 0د" came out as "1د0 س". Arabic gets U+2067 (RLI), Latin U+2066 (LRI).
  const open = language === 'ar' ? '\u2067' : '\u2066';
  const close = '\u2069';

  const hourUnit = language === 'ar' ? 'س' : 'h';
  const minuteUnit = language === 'ar' ? 'د' : 'm';

  if (!seconds || seconds < 0) {
    return language === 'ar' ? `${open}0${minuteUnit}${close}` : `${open}0:00${close}`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const text = hours > 0
    ? `${hours}${hourUnit} ${minutes}${minuteUnit}`
    : `${minutes}${minuteUnit}`;
  return `${open}${text}${close}`;
}

export function formatDurationLong(seconds: number, language: 'en' | 'ar' = 'en'): string {
  if (!seconds || seconds < 0) return language === 'ar' ? '0 ثانية' : '0 seconds';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (language === 'ar') {
    if (hours > 0) parts.push(`${hours} ساعة`);
    if (minutes > 0) parts.push(`${minutes} دقيقة`);
    if (secs > 0 && hours === 0) parts.push(`${secs} ثانية`);
    return parts.join('، ') || '0 ثانية';
  }

  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (secs > 0 && hours === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
  
  return parts.join(', ') || '0 seconds';
}
