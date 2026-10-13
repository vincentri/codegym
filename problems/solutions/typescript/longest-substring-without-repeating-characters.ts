function lengthOfLongestSubstring(s: string): number {
  const lastSeen = new Map<string, number>();
  let best = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = lastSeen.get(ch);
    if (prev !== undefined && prev >= start) {
      start = prev + 1;
    }
    lastSeen.set(ch, i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}
