class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int n = temperatures.length;
        int[] answer = new int[n];
        int[] stack = new int[n]; // indices of days still waiting for a warmer day
        int top = 0;
        for (int i = 0; i < n; i++) {
            while (top > 0 && temperatures[stack[top - 1]] < temperatures[i]) {
                int j = stack[--top];
                answer[j] = i - j;
            }
            stack[top++] = i;
        }
        return answer;
    }
}
