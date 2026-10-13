impl Solution {
    pub fn is_anagram(s: String, t: String) -> bool {
        if s.len() != t.len() {
            return false;
        }
        let mut counts: HashMap<char, i32> = HashMap::new();
        for c in s.chars() {
            *counts.entry(c).or_insert(0) += 1;
        }
        for c in t.chars() {
            let e = counts.entry(c).or_insert(0);
            *e -= 1;
            if *e < 0 {
                return false;
            }
        }
        true
    }
}
