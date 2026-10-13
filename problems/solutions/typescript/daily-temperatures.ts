function dailyTemperatures(temperatures: number[]): number[] {
  const n = temperatures.length;
  const answer: number[] = new Array(n).fill(0);
  const stack: number[] = []; // indices of days still waiting for a warmer day
  for (let i = 0; i < n; i++) {
    while (stack.length && temperatures[stack[stack.length - 1]] < temperatures[i]) {
      const j = stack.pop()!;
      answer[j] = i - j;
    }
    stack.push(i);
  }
  return answer;
}
