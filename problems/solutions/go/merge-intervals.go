func merge(intervals [][]int) [][]int {
	sorted := slices.Clone(intervals)
	slices.SortFunc(sorted, func(a, b []int) int { return a[0] - b[0] })
	merged := [][]int{}
	for _, iv := range sorted {
		if last := len(merged) - 1; last >= 0 && iv[0] <= merged[last][1] {
			merged[last][1] = max(merged[last][1], iv[1])
		} else {
			merged = append(merged, []int{iv[0], iv[1]})
		}
	}
	return merged
}
