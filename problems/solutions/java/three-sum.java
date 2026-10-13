class Solution {
    public int[][] threeSum(int[] nums) {
        int[] sorted = nums.clone();
        Arrays.sort(sorted);
        int n = sorted.length;
        List<int[]> result = new ArrayList<>();
        for (int i = 0; i < n - 2; i++) {
            if (sorted[i] > 0) break;
            if (i > 0 && sorted[i] == sorted[i - 1]) continue;
            int lo = i + 1, hi = n - 1;
            while (lo < hi) {
                int sum = sorted[i] + sorted[lo] + sorted[hi];
                if (sum < 0) {
                    lo++;
                } else if (sum > 0) {
                    hi--;
                } else {
                    result.add(new int[] {sorted[i], sorted[lo], sorted[hi]});
                    lo++;
                    hi--;
                    while (lo < hi && sorted[lo] == sorted[lo - 1]) lo++;
                    while (lo < hi && sorted[hi] == sorted[hi + 1]) hi--;
                }
            }
        }
        return result.toArray(new int[0][]);
    }
}
