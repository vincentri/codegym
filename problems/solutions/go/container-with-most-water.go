func maxArea(height []int) int {
	lo, hi := 0, len(height)-1
	best := 0
	for lo < hi {
		best = max(best, min(height[lo], height[hi])*(hi-lo))
		if height[lo] < height[hi] {
			lo++
		} else {
			hi--
		}
	}
	return best
}
