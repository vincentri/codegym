func topKFrequent(nums []int, k int) []int {
	counts := map[int]int{}
	for _, x := range nums {
		counts[x]++
	}
	// buckets[f] holds every value that occurs exactly f times
	buckets := make([][]int, len(nums)+1)
	for value, freq := range counts {
		buckets[freq] = append(buckets[freq], value)
	}
	result := make([]int, 0, k)
	for f := len(nums); f > 0; f-- {
		for _, value := range buckets[f] {
			result = append(result, value)
			if len(result) == k {
				return result
			}
		}
	}
	return result
}
