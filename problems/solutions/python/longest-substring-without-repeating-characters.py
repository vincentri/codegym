class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last_seen = {}
        best = 0
        start = 0
        for i, ch in enumerate(s):
            if last_seen.get(ch, -1) >= start:
                start = last_seen[ch] + 1
            last_seen[ch] = i
            best = max(best, i - start + 1)
        return best
