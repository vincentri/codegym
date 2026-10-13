func lengthOfLIS(nums []int) int {
	// tails[k] = smallest possible tail of an increasing subsequence of length k + 1
	tails := []int{}
	for _, x := range nums {
		i := sort.SearchInts(tails, x)
		if i == len(tails) {
			tails = append(tails, x)
		} else {
			tails[i] = x
		}
	}
	return len(tails)
}
