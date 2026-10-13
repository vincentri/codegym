impl Solution {
    pub fn word_break(s: String, word_dict: Vec<String>) -> bool {
        let words: HashSet<&str> = word_dict.iter().map(|w| w.as_str()).collect();
        let max_len = word_dict.iter().map(|w| w.len()).max().unwrap_or(0);
        let n = s.len();
        // dp[i]: s[..i] can be segmented.
        let mut dp = vec![false; n + 1];
        dp[0] = true;
        for i in 1..=n {
            for j in i.saturating_sub(max_len)..i {
                if dp[j] && s.get(j..i).map_or(false, |w| words.contains(w)) {
                    dp[i] = true;
                    break;
                }
            }
        }
        dp[n]
    }
}
