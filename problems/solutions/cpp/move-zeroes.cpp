class Solution {
public:
    void moveZeroes(vector<int>& nums) {
        int write = 0;
        for (int i = 0; i < (int)nums.size(); i++) {
            if (nums[i] != 0) swap(nums[write++], nums[i]);
        }
    }
};
