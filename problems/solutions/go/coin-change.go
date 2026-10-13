func coinChange(coins []int, amount int) int {
	inf := amount + 1
	dp := make([]int, amount+1)
	for a := 1; a <= amount; a++ {
		dp[a] = inf
		for _, coin := range coins {
			if coin <= a && dp[a-coin]+1 < dp[a] {
				dp[a] = dp[a-coin] + 1
			}
		}
	}
	if dp[amount] == inf {
		return -1
	}
	return dp[amount]
}
