function minDistance(word1: string, word2: string): number {
  const m = word1.length, n = word2.length;
  // prev[j] = edit distance between word1[0..i-1) and word2[0..j)
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      if (word1[i - 1] === word2[j - 1]) cur[j] = prev[j - 1];
      else cur[j] = 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}
