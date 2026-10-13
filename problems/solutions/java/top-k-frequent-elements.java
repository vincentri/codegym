class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int x : nums) counts.merge(x, 1, Integer::sum);
        // buckets[f] holds every value that occurs exactly f times
        List<List<Integer>> buckets = new ArrayList<>();
        for (int f = 0; f <= nums.length; f++) buckets.add(new ArrayList<>());
        for (Map.Entry<Integer, Integer> e : counts.entrySet()) buckets.get(e.getValue()).add(e.getKey());
        int[] result = new int[k];
        int size = 0;
        for (int f = nums.length; f > 0 && size < k; f--) {
            for (int value : buckets.get(f)) {
                result[size++] = value;
                if (size == k) break;
            }
        }
        return result;
    }
}
