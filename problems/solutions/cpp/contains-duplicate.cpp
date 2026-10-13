class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        unordered_set<int> seen;
        for (int n : nums) {
            if (!seen.insert(n).second) return true;
        }
        return false;
    }
};
