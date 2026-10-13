class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        int n = temperatures.size();
        vector<int> result(n, 0);
        vector<int> stack;  // indices with strictly decreasing temperatures
        for (int i = 0; i < n; i++) {
            while (!stack.empty() && temperatures[stack.back()] < temperatures[i]) {
                result[stack.back()] = i - stack.back();
                stack.pop_back();
            }
            stack.push_back(i);
        }
        return result;
    }
};
