impl Solution {
    pub fn min_window(s: String, t: String) -> String {
        if t.is_empty() {
            return String::new();
        }
        let s_chars: Vec<char> = s.chars().collect();
        let mut need: HashMap<char, i32> = HashMap::new();
        for c in t.chars() {
            *need.entry(c).or_insert(0) += 1;
        }
        // `missing` counts characters of t not yet covered by the window.
        let mut missing = t.chars().count();
        let mut best: Option<(usize, usize)> = None;
        let mut left = 0;
        for right in 0..s_chars.len() {
            if let Some(cnt) = need.get_mut(&s_chars[right]) {
                if *cnt > 0 {
                    missing -= 1;
                }
                *cnt -= 1;
            }
            while missing == 0 {
                if best.map_or(true, |(l, r)| right + 1 - left < r - l) {
                    best = Some((left, right + 1));
                }
                if let Some(cnt) = need.get_mut(&s_chars[left]) {
                    *cnt += 1;
                    if *cnt > 0 {
                        missing += 1;
                    }
                }
                left += 1;
            }
        }
        match best {
            Some((l, r)) => s_chars[l..r].iter().collect(),
            None => String::new(),
        }
    }
}
