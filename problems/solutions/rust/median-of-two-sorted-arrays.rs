impl Solution {
    pub fn find_median_sorted_arrays(nums1: Vec<i32>, nums2: Vec<i32>) -> f64 {
        let (a, b) = if nums1.len() <= nums2.len() { (nums1, nums2) } else { (nums2, nums1) };
        let (m, n) = (a.len(), b.len());
        let half = (m + n + 1) / 2;
        let (mut lo, mut hi) = (0, m);
        loop {
            let i = (lo + hi) / 2; // elements taken from a into the left half
            let j = half - i; // elements taken from b into the left half
            let left1 = if i > 0 { a[i - 1] as i64 } else { i64::MIN };
            let right1 = if i < m { a[i] as i64 } else { i64::MAX };
            let left2 = if j > 0 { b[j - 1] as i64 } else { i64::MIN };
            let right2 = if j < n { b[j] as i64 } else { i64::MAX };
            if left1 > right2 {
                hi = i - 1;
            } else if left2 > right1 {
                lo = i + 1;
            } else {
                let left_max = max(left1, left2);
                if (m + n) % 2 == 1 {
                    return left_max as f64;
                }
                return (left_max + min(right1, right2)) as f64 / 2.0;
            }
        }
    }
}
