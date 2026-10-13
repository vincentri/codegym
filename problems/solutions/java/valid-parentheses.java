class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            char open;
            switch (c) {
                case ')': open = '('; break;
                case ']': open = '['; break;
                case '}': open = '{'; break;
                default:
                    stack.push(c);
                    continue;
            }
            if (stack.isEmpty() || stack.pop() != open) return false;
        }
        return stack.isEmpty();
    }
}
