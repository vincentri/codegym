impl Solution {
    pub fn num_islands(mut grid: Vec<Vec<char>>) -> i32 {
        let rows = grid.len();
        let mut count = 0;
        for r in 0..rows {
            for c in 0..grid[r].len() {
                if grid[r][c] != '1' {
                    continue;
                }
                count += 1;
                // Iterative DFS, sinking each land cell as it is visited.
                grid[r][c] = '0';
                let mut stack = vec![(r, c)];
                while let Some((i, j)) = stack.pop() {
                    let neighbors = [
                        (i.wrapping_sub(1), j),
                        (i + 1, j),
                        (i, j.wrapping_sub(1)),
                        (i, j + 1),
                    ];
                    for (ni, nj) in neighbors {
                        if ni < rows && nj < grid[ni].len() && grid[ni][nj] == '1' {
                            grid[ni][nj] = '0';
                            stack.push((ni, nj));
                        }
                    }
                }
            }
        }
        count
    }
}
