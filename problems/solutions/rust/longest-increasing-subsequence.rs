impl Solution {
    pub fn length_of_lis(nums: Vec<i32>) -> i32 {
        // tails[k] is the smallest tail of any increasing subsequence of length k + 1.
        let mut tails: Vec<i32> = Vec::new();
        for x in nums {
            let pos = tails.partition_point(|&t| t < x);
            if pos == tails.len() {
                tails.push(x);
            } else {
                tails[pos] = x;
            }
        }
        tails.len() as i32
    }
}
