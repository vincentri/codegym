class Solution {
public:
    int lengthOfLIS(vector<int>& nums) {
        // tails[i] is the smallest tail of any increasing subsequence of length i+1
        vector<int> tails;
        for (int n : nums) {
            auto it = lower_bound(tails.begin(), tails.end(), n);
            if (it == tails.end()) tails.push_back(n);
            else *it = n;
        }
        return tails.size();
    }
};
