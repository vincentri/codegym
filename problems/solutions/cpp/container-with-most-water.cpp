class Solution {
public:
    int maxArea(vector<int>& height) {
        int lo = 0, hi = (int)height.size() - 1;
        long long best = 0;
        while (lo < hi) {
            long long area = (long long)min(height[lo], height[hi]) * (hi - lo);
            best = max(best, area);
            if (height[lo] < height[hi]) lo++;
            else hi--;
        }
        return (int)best;
    }
};
