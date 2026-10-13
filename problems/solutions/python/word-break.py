class Solution:
    def wordBreak(self, s: str, wordDict: List[str]) -> bool:
        words = set(wordDict)
        lengths = {len(w) for w in words}
        # ok[i] is True when the prefix s[:i] can be segmented
        ok = [True] + [False] * len(s)
        for i in range(1, len(s) + 1):
            ok[i] = any(n <= i and ok[i - n] and s[i - n:i] in words for n in lengths)
        return ok[len(s)]
