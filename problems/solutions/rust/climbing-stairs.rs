impl Solution {
    pub fn climb_stairs(n: i32) -> i32 {
        let (mut a, mut b) = (1, 1);
        for _ in 1..n {
            let c = a + b;
            a = b;
            b = c;
        }
        b
    }
}
