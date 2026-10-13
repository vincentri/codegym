function isValid(s: string): boolean {
  const match: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  for (const c of s) {
    if (c in match) {
      if (stack.pop() !== match[c]) return false;
    } else {
      stack.push(c);
    }
  }
  return stack.length === 0;
}
