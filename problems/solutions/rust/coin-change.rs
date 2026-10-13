impl Solution {
    pub fn coin_change(coins: Vec<i32>, amount: i32) -> i32 {
        let amount = amount as usize;
        let unreachable = amount + 1;
        let mut dp = vec![unreachable; amount + 1];
        dp[0] = 0;
        for a in 1..=amount {
            for &c in &coins {
                let c = c as usize;
                if c <= a && dp[a - c] + 1 < dp[a] {
                    dp[a] = dp[a - c] + 1;
                }
            }
        }
        if dp[amount] == unreachable { -1 } else { dp[amount] as i32 }
    }
}
