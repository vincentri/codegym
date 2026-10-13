func numIslands(grid [][]byte) int {
	rows := len(grid)
	if rows == 0 {
		return 0
	}
	cols := len(grid[0])
	dirs := [4][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}
	count := 0
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			if grid[r][c] != '1' {
				continue
			}
			count++
			grid[r][c] = '0'
			stack := [][2]int{{r, c}}
			for len(stack) > 0 {
				cell := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				for _, d := range dirs {
					ni, nj := cell[0]+d[0], cell[1]+d[1]
					if ni >= 0 && ni < rows && nj >= 0 && nj < cols && grid[ni][nj] == '1' {
						grid[ni][nj] = '0'
						stack = append(stack, [2]int{ni, nj})
					}
				}
			}
		}
	}
	return count
}
