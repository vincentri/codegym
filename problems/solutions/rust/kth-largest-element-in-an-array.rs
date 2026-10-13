impl Solution {
    pub fn find_kth_largest(nums: Vec<i32>, k: i32) -> i32 {
        // Min-heap holding the k largest values seen so far; its root is the answer.
        let k = k as usize;
        let mut heap = BinaryHeap::with_capacity(k + 1);
        for x in nums {
            heap.push(Reverse(x));
            if heap.len() > k {
                heap.pop();
            }
        }
        heap.peek().unwrap().0
    }
}
