class Solution {
public:
    int minDistance(string& word1, string& word2) {
        int m = word1.size(), n = word2.size();
        // prev[j] is the distance between word1[0:i-1] and word2[0:j]
        vector<int> prev(n + 1), cur(n + 1);
        for (int j = 0; j <= n; j++) prev[j] = j;
        for (int i = 1; i <= m; i++) {
            cur[0] = i;
            for (int j = 1; j <= n; j++) {
                if (word1[i - 1] == word2[j - 1]) cur[j] = prev[j - 1];
                else cur[j] = 1 + min({prev[j - 1], prev[j], cur[j - 1]});
            }
            swap(prev, cur);
        }
        return prev[n];
    }
};
