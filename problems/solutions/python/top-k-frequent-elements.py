class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts = Counter(nums)
        # buckets[f] holds every value that occurs exactly f times
        buckets = [[] for _ in range(len(nums) + 1)]
        for value, freq in counts.items():
            buckets[freq].append(value)
        result = []
        for f in range(len(nums), 0, -1):
            for value in buckets[f]:
                result.append(value)
                if len(result) == k:
                    return result
        return result
