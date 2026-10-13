impl Solution {
    pub fn daily_temperatures(temperatures: Vec<i32>) -> Vec<i32> {
        let mut answer = vec![0; temperatures.len()];
        // Monotonic stack of indices whose warmer day hasn't been found yet.
        let mut stack: Vec<usize> = Vec::new();
        for (i, &t) in temperatures.iter().enumerate() {
            while let Some(&j) = stack.last() {
                if temperatures[j] >= t {
                    break;
                }
                stack.pop();
                answer[j] = (i - j) as i32;
            }
            stack.push(i);
        }
        answer
    }
}
