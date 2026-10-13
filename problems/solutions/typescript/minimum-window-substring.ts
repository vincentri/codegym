function minWindow(s: string, t: string): string {
  if (t.length === 0 || t.length > s.length) return "";
  const need = new Map<string, number>();
  for (const ch of t) need.set(ch, (need.get(ch) ?? 0) + 1);
  let missing = need.size; // distinct characters not yet fully covered
  let bestStart = 0;
  let bestLen = Infinity;
  let left = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    const count = need.get(ch);
    if (count !== undefined) {
      need.set(ch, count - 1);
      if (count - 1 === 0) missing--;
    }
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const out = s[left];
      const outCount = need.get(out);
      if (outCount !== undefined) {
        need.set(out, outCount + 1);
        if (outCount + 1 > 0) missing++;
      }
      left++;
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
}
