impl Solution {
    pub fn min_distance(word1: String, word2: String) -> i32 {
        let a: Vec<char> = word1.chars().collect();
        let b: Vec<char> = word2.chars().collect();
        // Rolling single-row DP: prev[j] = distance between a[..i] and b[..j].
        let mut prev: Vec<i32> = (0..=b.len() as i32).collect();
        let mut cur = vec![0; b.len() + 1];
        for i in 1..=a.len() {
            cur[0] = i as i32;
            for j in 1..=b.len() {
                cur[j] = if a[i - 1] == b[j - 1] {
                    prev[j - 1]
                } else {
                    1 + min(prev[j - 1], min(prev[j], cur[j - 1]))
                };
            }
            std::mem::swap(&mut prev, &mut cur);
        }
        prev[b.len()]
    }
}
