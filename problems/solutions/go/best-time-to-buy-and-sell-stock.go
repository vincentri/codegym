func maxProfit(prices []int) int {
	minPrice := math.MaxInt
	best := 0
	for _, p := range prices {
		minPrice = min(minPrice, p)
		best = max(best, p-minPrice)
	}
	return best
}
