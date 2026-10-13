class Solution {
public:
    bool isValid(string& s) {
        vector<char> stack;
        for (char c : s) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push_back(c);
            } else {
                char open = c == ')' ? '(' : c == ']' ? '[' : '{';
                if (stack.empty() || stack.back() != open) return false;
                stack.pop_back();
            }
        }
        return stack.empty();
    }
};
