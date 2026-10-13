func lengthOfLongestSubstring(s string) int {
	lastSeen := map[byte]int{}
	best, start := 0, 0
	for i := 0; i < len(s); i++ {
		if j, ok := lastSeen[s[i]]; ok && j >= start {
			start = j + 1
		}
		lastSeen[s[i]] = i
		best = max(best, i-start+1)
	}
	return best
}
