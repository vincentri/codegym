class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        indegree = [0] * numCourses
        nxt = [[] for _ in range(numCourses)]
        for course, pre in prerequisites:
            nxt[pre].append(course)
            indegree[course] += 1
        queue = deque(i for i in range(numCourses) if indegree[i] == 0)
        taken = 0
        while queue:
            c = queue.popleft()
            taken += 1
            for n in nxt[c]:
                indegree[n] -= 1
                if indegree[n] == 0:
                    queue.append(n)
        return taken == numCourses
