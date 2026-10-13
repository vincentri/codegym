impl Solution {
    pub fn search(nums: Vec<i32>, target: i32) -> i32 {
        let (mut lo, mut hi) = (0i32, nums.len() as i32 - 1);
        while lo <= hi {
            let mid = lo + (hi - lo) / 2;
            let m = nums[mid as usize];
            if m == target {
                return mid;
            }
            let (l, h) = (nums[lo as usize], nums[hi as usize]);
            if l <= m {
                // Left half [lo, mid] is sorted.
                if l <= target && target < m {
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            } else {
                // Right half [mid, hi] is sorted.
                if m < target && target <= h {
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
        }
        -1
    }
}
