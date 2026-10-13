class Solution {
public:
    int climbStairs(int n) {
        long long a = 1, b = 1;  // ways to reach step i-1 and step i
        for (int i = 2; i <= n; i++) {
            long long c = a + b;
            a = b;
            b = c;
        }
        return (int)b;
    }
};
