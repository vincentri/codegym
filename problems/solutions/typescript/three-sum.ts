function threeSum(nums: number[]): number[][] {
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const result: number[][] = [];
  for (let i = 0; i < n - 2; i++) {
    if (sorted[i] > 0) break;
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    let lo = i + 1;
    let hi = n - 1;
    while (lo < hi) {
      const sum = sorted[i] + sorted[lo] + sorted[hi];
      if (sum < 0) {
        lo++;
      } else if (sum > 0) {
        hi--;
      } else {
        result.push([sorted[i], sorted[lo], sorted[hi]]);
        lo++;
        hi--;
        while (lo < hi && sorted[lo] === sorted[lo - 1]) lo++;
        while (lo < hi && sorted[hi] === sorted[hi + 1]) hi--;
      }
    }
  }
  return result;
}
