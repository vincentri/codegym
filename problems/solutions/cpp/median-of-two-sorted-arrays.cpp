class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        const vector<int>& a = nums1.size() <= nums2.size() ? nums1 : nums2;
        const vector<int>& b = nums1.size() <= nums2.size() ? nums2 : nums1;
        int m = a.size(), n = b.size();
        int half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = lo + (hi - lo) / 2;  // elements taken from a into the left half
            int j = half - i;            // elements taken from b into the left half
            long long left1 = i > 0 ? a[i - 1] : LLONG_MIN;
            long long right1 = i < m ? a[i] : LLONG_MAX;
            long long left2 = j > 0 ? b[j - 1] : LLONG_MIN;
            long long right2 = j < n ? b[j] : LLONG_MAX;
            if (left1 > right2) {
                hi = i - 1;
            } else if (left2 > right1) {
                lo = i + 1;
            } else {
                long long leftMax = max(left1, left2);
                if ((m + n) % 2 == 1) return (double)leftMax;
                return (leftMax + min(right1, right2)) / 2.0;
            }
        }
        return 0.0;
    }
};
