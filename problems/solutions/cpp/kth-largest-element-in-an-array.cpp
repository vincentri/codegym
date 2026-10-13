class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        // min-heap holding the k largest values seen so far
        priority_queue<int, vector<int>, greater<int>> heap;
        for (int n : nums) {
            heap.push(n);
            if ((int)heap.size() > k) heap.pop();
        }
        return heap.top();
    }
};
