class Solution {
public:
    bool wordBreak(string& s, vector<string>& wordDict) {
        unordered_set<string> words(wordDict.begin(), wordDict.end());
        size_t maxLen = 0;
        for (const string& w : wordDict) maxLen = max(maxLen, w.size());
        int n = s.size();
        // dp[i] is true when s[0:i] can be segmented
        vector<bool> dp(n + 1, false);
        dp[0] = true;
        for (int i = 1; i <= n; i++) {
            for (int j = i - 1; j >= 0 && (size_t)(i - j) <= maxLen; j--) {
                if (dp[j] && words.count(s.substr(j, i - j))) {
                    dp[i] = true;
                    break;
                }
            }
        }
        return dp[n];
    }
};
