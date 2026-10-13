func findMedianSortedArrays(nums1 []int, nums2 []int) float64 {
	if len(nums1) > len(nums2) {
		nums1, nums2 = nums2, nums1
	}
	m, n := len(nums1), len(nums2)
	half := (m + n + 1) / 2
	lo, hi := 0, m
	for lo <= hi {
		i := (lo + hi) / 2 // elements taken from nums1 into the left half
		j := half - i      // elements taken from nums2 into the left half
		left1, right1 := math.MinInt, math.MaxInt
		left2, right2 := math.MinInt, math.MaxInt
		if i > 0 {
			left1 = nums1[i-1]
		}
		if i < m {
			right1 = nums1[i]
		}
		if j > 0 {
			left2 = nums2[j-1]
		}
		if j < n {
			right2 = nums2[j]
		}
		if left1 > right2 {
			hi = i - 1
		} else if left2 > right1 {
			lo = i + 1
		} else {
			leftMax := max(left1, left2)
			if (m+n)%2 == 1 {
				return float64(leftMax)
			}
			return float64(leftMax+min(right1, right2)) / 2
		}
	}
	return 0
}
