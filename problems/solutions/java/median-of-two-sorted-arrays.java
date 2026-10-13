class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);
        int m = nums1.length, n = nums2.length;
        int half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = (lo + hi) / 2; // elements taken from nums1 into the left half
            int j = half - i;      // elements taken from nums2 into the left half
            int left1 = i > 0 ? nums1[i - 1] : Integer.MIN_VALUE;
            int right1 = i < m ? nums1[i] : Integer.MAX_VALUE;
            int left2 = j > 0 ? nums2[j - 1] : Integer.MIN_VALUE;
            int right2 = j < n ? nums2[j] : Integer.MAX_VALUE;
            if (left1 > right2) {
                hi = i - 1;
            } else if (left2 > right1) {
                lo = i + 1;
            } else {
                int leftMax = Math.max(left1, left2);
                if ((m + n) % 2 == 1) return leftMax;
                return ((long) leftMax + Math.min(right1, right2)) / 2.0;
            }
        }
        return 0.0;
    }
}
