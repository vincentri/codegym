class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        n = len(word2)
        # prev[j] = edit distance between the current prefix of word1 and word2[:j]
        prev = list(range(n + 1))
        for i, a in enumerate(word1, 1):
            cur = [i] + [0] * n
            for j, b in enumerate(word2, 1):
                if a == b:
                    cur[j] = prev[j - 1]
                else:
                    cur[j] = 1 + min(prev[j - 1], prev[j], cur[j - 1])
            prev = cur
        return prev[n]
