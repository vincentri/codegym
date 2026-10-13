class Solution {
    public String[][] groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String s : strs) {
            int[] counts = new int[26];
            for (int i = 0; i < s.length(); i++) counts[s.charAt(i) - 'a']++;
            String key = Arrays.toString(counts);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        String[][] result = new String[groups.size()][];
        int i = 0;
        for (List<String> group : groups.values()) result[i++] = group.toArray(new String[0]);
        return result;
    }
}
