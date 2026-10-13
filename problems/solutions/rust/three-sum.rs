impl Solution {
    pub fn three_sum(mut nums: Vec<i32>) -> Vec<Vec<i32>> {
        nums.sort_unstable();
        let n = nums.len();
        let mut result = Vec::new();
        for i in 0..n {
            if nums[i] > 0 {
                break;
            }
            if i > 0 && nums[i] == nums[i - 1] {
                continue;
            }
            let (mut lo, mut hi) = (i + 1, n.saturating_sub(1));
            while lo < hi {
                let sum = nums[i] + nums[lo] + nums[hi];
                match sum.cmp(&0) {
                    Ordering::Less => lo += 1,
                    Ordering::Greater => hi -= 1,
                    Ordering::Equal => {
                        result.push(vec![nums[i], nums[lo], nums[hi]]);
                        lo += 1;
                        hi -= 1;
                        while lo < hi && nums[lo] == nums[lo - 1] {
                            lo += 1;
                        }
                    }
                }
            }
        }
        result
    }
}
