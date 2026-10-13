class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        vector<int> sorted(nums);
        sort(sorted.begin(), sorted.end());
        int n = sorted.size();
        vector<vector<int>> result;
        for (int i = 0; i < n - 2; i++) {
            if (sorted[i] > 0) break;
            if (i > 0 && sorted[i] == sorted[i - 1]) continue;
            int lo = i + 1, hi = n - 1;
            while (lo < hi) {
                long long sum = (long long)sorted[i] + sorted[lo] + sorted[hi];
                if (sum < 0) {
                    lo++;
                } else if (sum > 0) {
                    hi--;
                } else {
                    result.push_back({sorted[i], sorted[lo], sorted[hi]});
                    lo++;
                    hi--;
                    while (lo < hi && sorted[lo] == sorted[lo - 1]) lo++;
                    while (lo < hi && sorted[hi] == sorted[hi + 1]) hi--;
                }
            }
        }
        return result;
    }
};
