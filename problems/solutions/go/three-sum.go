func threeSum(nums []int) [][]int {
	sorted := slices.Clone(nums)
	slices.Sort(sorted)
	n := len(sorted)
	result := [][]int{}
	for i := 0; i < n-2; i++ {
		if sorted[i] > 0 {
			break
		}
		if i > 0 && sorted[i] == sorted[i-1] {
			continue
		}
		lo, hi := i+1, n-1
		for lo < hi {
			sum := sorted[i] + sorted[lo] + sorted[hi]
			switch {
			case sum < 0:
				lo++
			case sum > 0:
				hi--
			default:
				result = append(result, []int{sorted[i], sorted[lo], sorted[hi]})
				lo++
				hi--
				for lo < hi && sorted[lo] == sorted[lo-1] {
					lo++
				}
				for lo < hi && sorted[hi] == sorted[hi+1] {
					hi--
				}
			}
		}
	}
	return result
}
