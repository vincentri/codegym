func canFinish(numCourses int, prerequisites [][]int) bool {
	indegree := make([]int, numCourses)
	next := make([][]int, numCourses)
	for _, p := range prerequisites {
		course, pre := p[0], p[1]
		next[pre] = append(next[pre], course)
		indegree[course]++
	}
	queue := []int{}
	for i := 0; i < numCourses; i++ {
		if indegree[i] == 0 {
			queue = append(queue, i)
		}
	}
	taken := 0
	for taken < len(queue) {
		c := queue[taken]
		taken++
		for _, n := range next[c] {
			indegree[n]--
			if indegree[n] == 0 {
				queue = append(queue, n)
			}
		}
	}
	return taken == numCourses
}
