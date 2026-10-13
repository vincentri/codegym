function numIslands(grid) {
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== "1") continue;
      count++;
      grid[r][c] = "0";
      const stack = [[r, c]];
      while (stack.length) {
        const [i, j] = stack.pop();
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && grid[ni][nj] === "1") {
            grid[ni][nj] = "0";
            stack.push([ni, nj]);
          }
        }
      }
    }
  }
  return count;
}
