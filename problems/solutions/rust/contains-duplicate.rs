impl Solution {
    pub fn contains_duplicate(nums: Vec<i32>) -> bool {
        let mut seen = HashSet::with_capacity(nums.len());
        nums.into_iter().any(|x| !seen.insert(x))
    }
}
