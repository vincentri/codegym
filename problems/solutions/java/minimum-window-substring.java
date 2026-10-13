class Solution {
    public String minWindow(String s, String t) {
        if (t.isEmpty() || t.length() > s.length()) return "";
        int[] need = new int[128];
        int missing = 0; // distinct characters not yet fully covered
        for (int i = 0; i < t.length(); i++) {
            if (need[t.charAt(i)]++ == 0) missing++;
        }
        boolean[] inT = new boolean[128];
        for (int i = 0; i < t.length(); i++) inT[t.charAt(i)] = true;
        int bestStart = 0, bestLen = Integer.MAX_VALUE;
        int left = 0;
        for (int right = 0; right < s.length(); right++) {
            char ch = s.charAt(right);
            if (inT[ch] && --need[ch] == 0) missing--;
            while (missing == 0) {
                if (right - left + 1 < bestLen) {
                    bestLen = right - left + 1;
                    bestStart = left;
                }
                char out = s.charAt(left);
                if (inT[out] && ++need[out] > 0) missing++;
                left++;
            }
        }
        return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen);
    }
}
