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
  if (!seconds || seconds < 0) return language === 'ar' ? '\u2066٠ د\u2069' : '\u20660:00\u2069';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const hourUnit = language === 'ar' ? 'س' : 'h';
  const minuteUnit = language === 'ar' ? 'د' : 'm';

  const text = hours > 0
    ? `${hours}${hourUnit} ${minutes}${minuteUnit}`
    : `${minutes}${minuteUnit}`;
  return `\u2066${text}\u2069`;
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
