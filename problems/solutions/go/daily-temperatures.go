func dailyTemperatures(temperatures []int) []int {
	answer := make([]int, len(temperatures))
	stack := []int{} // indices of days still waiting for a warmer day
	for i, temp := range temperatures {
		for len(stack) > 0 && temperatures[stack[len(stack)-1]] < temp {
			j := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			answer[j] = i - j
		}
		stack = append(stack, i)
	}
	return answer
}
