func wordBreak(s string, wordDict []string) bool {
	words := map[string]bool{}
	lengths := map[int]bool{}
	for _, w := range wordDict {
		words[w] = true
		lengths[len(w)] = true
	}
	// ok[i] is true when the prefix s[:i] can be segmented
	ok := make([]bool, len(s)+1)
	ok[0] = true
	for i := 1; i <= len(s); i++ {
		for n := range lengths {
			if n <= i && ok[i-n] && words[s[i-n:i]] {
				ok[i] = true
				break
			}
		}
	}
	return ok[len(s)]
}
