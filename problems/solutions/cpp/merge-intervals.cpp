class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        vector<vector<int>> sorted(intervals);
        sort(sorted.begin(), sorted.end(), [](const vector<int>& a, const vector<int>& b) { return a[0] < b[0]; });
        vector<vector<int>> merged;
        for (const auto& iv : sorted) {
            if (!merged.empty() && iv[0] <= merged.back()[1]) {
                merged.back()[1] = max(merged.back()[1], iv[1]);
            } else {
                merged.push_back({iv[0], iv[1]});
            }
        }
        return merged;
    }
};
