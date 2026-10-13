class Solution {
    public int findKthLargest(int[] nums, int k) {
        // Min-heap holding the k largest values seen so far; its head is the answer.
        PriorityQueue<Integer> heap = new PriorityQueue<>(k);
        for (int x : nums) {
            if (heap.size() < k) {
                heap.offer(x);
            } else if (x > heap.peek()) {
                heap.poll();
                heap.offer(x);
            }
        }
        return heap.peek();
    }
}
