func minDistance(word1 string, word2 string) int {
	m, n := len(word1), len(word2)
	// prev[j] = edit distance between the current prefix of word1 and word2[:j]
	prev := make([]int, n+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= m; i++ {
		cur := make([]int, n+1)
		cur[0] = i
		for j := 1; j <= n; j++ {
			if word1[i-1] == word2[j-1] {
				cur[j] = prev[j-1]
			} else {
				cur[j] = 1 + min(prev[j-1], prev[j], cur[j-1])
			}
		}
		prev = cur
	}
	return prev[n]
}
