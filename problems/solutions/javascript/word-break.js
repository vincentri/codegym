function wordBreak(s, wordDict) {
  const words = new Set(wordDict);
  const lengths = [...new Set(wordDict.map((w) => w.length))];
  // ok[i] is true when the prefix s[0..i) can be segmented
  const ok = new Array(s.length + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= s.length; i++) {
    for (const len of lengths) {
      if (len <= i && ok[i - len] && words.has(s.slice(i - len, i))) {
        ok[i] = true;
        break;
      }
    }
  }
  return ok[s.length];
}
