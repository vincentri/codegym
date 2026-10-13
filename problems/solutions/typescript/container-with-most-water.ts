function maxArea(height: number[]): number {
  let lo = 0;
  let hi = height.length - 1;
  let best = 0;
  while (lo < hi) {
    const area = Math.min(height[lo], height[hi]) * (hi - lo);
    best = Math.max(best, area);
    if (height[lo] < height[hi]) {
      lo++;
    } else {
      hi--;
    }
  }
  return best;
}
