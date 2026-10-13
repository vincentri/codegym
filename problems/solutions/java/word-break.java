class Solution {
    public boolean wordBreak(String s, String[] wordDict) {
        Set<String> words = new HashSet<>(Arrays.asList(wordDict));
        Set<Integer> lengths = new TreeSet<>();
        for (String w : wordDict) lengths.add(w.length());
        // ok[i] is true when the prefix s[0..i) can be segmented
        boolean[] ok = new boolean[s.length() + 1];
        ok[0] = true;
        for (int i = 1; i <= s.length(); i++) {
            for (int len : lengths) {
                if (len <= i && ok[i - len] && words.contains(s.substring(i - len, i))) {
                    ok[i] = true;
                    break;
                }
            }
        }
        return ok[s.length()];
    }
}
