class Solution:
    def minWindow(self, s: str, t: str) -> str:
        if not t or len(t) > len(s):
            return ""
        need = Counter(t)
        missing = len(need)  # distinct characters not yet fully covered
        best_start, best_len = 0, math.inf
        left = 0
        for right, ch in enumerate(s):
            if ch in need:
                need[ch] -= 1
                if need[ch] == 0:
                    missing -= 1
            while missing == 0:
                if right - left + 1 < best_len:
                    best_start, best_len = left, right - left + 1
                out = s[left]
                if out in need:
                    need[out] += 1
                    if need[out] > 0:
                        missing += 1
                left += 1
        return "" if best_len == math.inf else s[best_start:best_start + best_len]
