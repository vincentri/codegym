impl Solution {
    pub fn trap(height: Vec<i32>) -> i32 {
        let (mut lo, mut hi) = (0, height.len());
        let (mut left_max, mut right_max) = (0, 0);
        let mut water = 0;
        while lo < hi {
            if height[lo] < height[hi - 1] {
                left_max = max(left_max, height[lo]);
                water += left_max - height[lo];
                lo += 1;
            } else {
                right_max = max(right_max, height[hi - 1]);
                water += right_max - height[hi - 1];
                hi -= 1;
            }
        }
        water
    }
}
