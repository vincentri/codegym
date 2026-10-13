func minWindow(s string, t string) string {
	if len(t) == 0 || len(t) > len(s) {
		return ""
	}
	need := map[byte]int{}
	for i := 0; i < len(t); i++ {
		need[t[i]]++
	}
	missing := len(need) // distinct characters not yet fully covered
	bestStart, bestLen := 0, -1
	left := 0
	for right := 0; right < len(s); right++ {
		if _, ok := need[s[right]]; ok {
			need[s[right]]--
			if need[s[right]] == 0 {
				missing--
			}
		}
		for missing == 0 {
			if bestLen == -1 || right-left+1 < bestLen {
				bestStart, bestLen = left, right-left+1
			}
			if _, ok := need[s[left]]; ok {
				need[s[left]]++
				if need[s[left]] > 0 {
					missing++
				}
			}
			left++
		}
	}
	if bestLen == -1 {
		return ""
	}
	return s[bestStart : bestStart+bestLen]
}
