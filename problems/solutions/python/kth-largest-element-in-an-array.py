class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        # Min-heap holding the k largest values seen so far; its root is the answer.
        heap = nums[:k]
        heapq.heapify(heap)
        for x in nums[k:]:
            if x > heap[0]:
                heapq.heapreplace(heap, x)
        return heap[0]
