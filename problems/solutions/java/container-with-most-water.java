class Solution {
    public int maxArea(int[] height) {
        int lo = 0, hi = height.length - 1;
        int best = 0;
        while (lo < hi) {
            best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
            if (height[lo] < height[hi]) lo++;
            else hi--;
        }
        return best;
    }
}
