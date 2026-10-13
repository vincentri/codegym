class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int rows = grid.size();
        if (rows == 0) return 0;
        int cols = grid[0].size();
        vector<vector<bool>> visited(rows, vector<bool>(cols, false));
        int count = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] != '1' || visited[r][c]) continue;
                count++;
                // iterative DFS so large islands can't overflow the call stack
                vector<pair<int, int>> stack = {{r, c}};
                visited[r][c] = true;
                while (!stack.empty()) {
                    auto [cr, cc] = stack.back();
                    stack.pop_back();
                    const int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
                    for (int d = 0; d < 4; d++) {
                        int nr = cr + dr[d], nc = cc + dc[d];
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == '1' && !visited[nr][nc]) {
                            visited[nr][nc] = true;
                            stack.push_back({nr, nc});
                        }
                    }
                }
            }
        }
        return count;
    }
};
