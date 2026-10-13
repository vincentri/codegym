class Solution {
    public int numIslands(char[][] grid) {
        int rows = grid.length;
        int cols = rows > 0 ? grid[0].length : 0;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        int count = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] != '1') continue;
                count++;
                grid[r][c] = '0';
                Deque<int[]> stack = new ArrayDeque<>();
                stack.push(new int[] {r, c});
                while (!stack.isEmpty()) {
                    int[] cell = stack.pop();
                    for (int[] d : dirs) {
                        int ni = cell[0] + d[0], nj = cell[1] + d[1];
                        if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && grid[ni][nj] == '1') {
                            grid[ni][nj] = '0';
                            stack.push(new int[] {ni, nj});
                        }
                    }
                }
            }
        }
        return count;
    }
}
