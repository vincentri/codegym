func climbStairs(n int) int {
	prev, curr := 1, 1
	for i := 2; i <= n; i++ {
		prev, curr = curr, prev+curr
	}
	return curr
}
