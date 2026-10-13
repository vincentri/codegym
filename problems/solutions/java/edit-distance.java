class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        // prev[j] = edit distance between word1[0..i-1) and word2[0..j)
        int[] prev = new int[n + 1];
        for (int j = 0; j <= n; j++) prev[j] = j;
        for (int i = 1; i <= m; i++) {
            int[] cur = new int[n + 1];
            cur[0] = i;
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) cur[j] = prev[j - 1];
                else cur[j] = 1 + Math.min(prev[j - 1], Math.min(prev[j], cur[j - 1]));
            }
            prev = cur;
        }
        return prev[n];
    }
}
