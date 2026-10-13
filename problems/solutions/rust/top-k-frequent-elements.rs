impl Solution {
    pub fn top_k_frequent(nums: Vec<i32>, k: i32) -> Vec<i32> {
        let mut counts: HashMap<i32, usize> = HashMap::new();
        for &x in &nums {
            *counts.entry(x).or_insert(0) += 1;
        }
        // Bucket sort by frequency: buckets[f] holds values seen exactly f times.
        let mut buckets: Vec<Vec<i32>> = vec![Vec::new(); nums.len() + 1];
        for (x, f) in counts {
            buckets[f].push(x);
        }
        buckets.into_iter().rev().flatten().take(k as usize).collect()
    }
}
