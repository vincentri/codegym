class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> lastSeen = new HashMap<>();
        int best = 0, start = 0;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            Integer prev = lastSeen.get(ch);
            if (prev != null && prev >= start) start = prev + 1;
            lastSeen.put(ch, i);
            best = Math.max(best, i - start + 1);
        }
        return best;
    }
}
