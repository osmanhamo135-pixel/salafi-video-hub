// Wrapped in a Unicode LTR isolate (U+2066 … U+2069). The value is a number
// followed by a Latin unit, so in an Arabic (RTL) paragraph the bidi algorithm
// reorders it and "0 B" renders as "B 0". Isolating here fixes every call site,
// including plain string interpolation where a <bdi> element is not an option.
const ltr = (value: string) => `\u2066${value}\u2069`;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return ltr('0 B');

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return ltr(`${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`);
}
