impl Solution {
    pub fn merge(mut intervals: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        intervals.sort_unstable_by_key(|iv| iv[0]);
        let mut merged: Vec<Vec<i32>> = Vec::new();
        for iv in intervals {
            match merged.last_mut() {
                Some(last) if iv[0] <= last[1] => last[1] = max(last[1], iv[1]),
                _ => merged.push(iv),
            }
        }
        merged
    }
}
