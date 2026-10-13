class Solution:
    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:
        if len(nums1) > len(nums2):
            nums1, nums2 = nums2, nums1
        m, n = len(nums1), len(nums2)
        half = (m + n + 1) // 2
        lo, hi = 0, m
        while lo <= hi:
            i = (lo + hi) // 2  # elements taken from nums1 into the left half
            j = half - i        # elements taken from nums2 into the left half
            left1 = nums1[i - 1] if i > 0 else -math.inf
            right1 = nums1[i] if i < m else math.inf
            left2 = nums2[j - 1] if j > 0 else -math.inf
            right2 = nums2[j] if j < n else math.inf
            if left1 > right2:
                hi = i - 1
            elif left2 > right1:
                lo = i + 1
            else:
                left_max = max(left1, left2)
                if (m + n) % 2:
                    return float(left_max)
                return (left_max + min(right1, right2)) / 2
        return 0.0
