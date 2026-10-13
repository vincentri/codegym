class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        min_price = math.inf
        best = 0
        for p in prices:
            min_price = min(min_price, p)
            best = max(best, p - min_price)
        return best
