class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        int[] indegree = new int[numCourses];
        List<List<Integer>> next = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) next.add(new ArrayList<>());
        for (int[] p : prerequisites) {
            next.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }
        Deque<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) queue.add(i);
        int taken = 0;
        while (!queue.isEmpty()) {
            int c = queue.poll();
            taken++;
            for (int n : next.get(c)) {
                if (--indegree[n] == 0) queue.add(n);
            }
        }
        return taken == numCourses;
    }
}
