impl Solution {
    pub fn length_of_longest_substring(s: String) -> i32 {
        let mut last: HashMap<char, usize> = HashMap::new();
        let mut start = 0;
        let mut best = 0;
        for (i, c) in s.chars().enumerate() {
            if let Some(&j) = last.get(&c) {
                if j >= start {
                    start = j + 1;
                }
            }
            last.insert(c, i);
            best = max(best, i + 1 - start);
        }
        best as i32
    }
}
