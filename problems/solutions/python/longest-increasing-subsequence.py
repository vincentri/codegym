class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        # tails[k] = smallest possible tail of an increasing subsequence of length k + 1
        tails = []
        for x in nums:
            i = bisect.bisect_left(tails, x)
            if i == len(tails):
                tails.append(x)
            else:
                tails[i] = x
        return len(tails)
