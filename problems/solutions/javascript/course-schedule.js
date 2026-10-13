function canFinish(numCourses, prerequisites) {
  const indegree = new Array(numCourses).fill(0);
  const next = Array.from({ length: numCourses }, () => []);
  for (const [course, pre] of prerequisites) {
    next[pre].push(course);
    indegree[course]++;
  }
  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
  let taken = 0;
  while (taken < queue.length) {
    const c = queue[taken++];
    for (const n of next[c]) {
      if (--indegree[n] === 0) queue.push(n);
    }
  }
  return taken === numCourses;
}
