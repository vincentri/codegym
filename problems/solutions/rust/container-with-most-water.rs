impl Solution {
    pub fn max_area(height: Vec<i32>) -> i32 {
        let (mut lo, mut hi) = (0, height.len().saturating_sub(1));
        let mut best = 0;
        while lo < hi {
            let h = min(height[lo], height[hi]);
            best = max(best, h * (hi - lo) as i32);
            if height[lo] < height[hi] {
                lo += 1;
            } else {
                hi -= 1;
            }
        }
        best
    }
}
