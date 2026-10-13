impl Solution {
    pub fn can_finish(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> bool {
        // Kahn's algorithm: the schedule works iff every course gets dequeued.
        let n = num_courses as usize;
        let mut adj = vec![Vec::new(); n];
        let mut indegree = vec![0; n];
        for p in &prerequisites {
            let (course, pre) = (p[0] as usize, p[1] as usize);
            adj[pre].push(course);
            indegree[course] += 1;
        }
        let mut queue: VecDeque<usize> = (0..n).filter(|&i| indegree[i] == 0).collect();
        let mut taken = 0;
        while let Some(c) = queue.pop_front() {
            taken += 1;
            for &next in &adj[c] {
                indegree[next] -= 1;
                if indegree[next] == 0 {
                    queue.push_back(next);
                }
            }
        }
        taken == n
    }
}
