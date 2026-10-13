import type { MentorMode } from "@/schemas";

export const MENTOR_REPLIES: Record<MentorMode, string> = {
  chat: "Good question! Before I answer directly, what have you tried so far, and where did you get stuck?",
  hint: "Here's a nudge: as you walk through `nums`, what would you need to **remember** about the numbers you've already seen so you could answer *\"have I seen `target - x` before?\"* in O(1)?",
  explain:
    "In plain words: you get a list of numbers and a goal number. Find **two different positions** whose values add up to the goal and return those positions.\n\nThink of it like finding two items in a shop whose prices add up exactly to the money in your pocket.",
  review:
    "Nice start! A few things I notice:\n\n1. Your nested loop checks every pair, which is **O(n²)**. That passes the examples but will be slow for 10⁴ elements.\n2. Variable names like `i` and `j` are fine, but `seen` / `complement` would make your intent clearer.\n\nWhat data structure gives O(1) lookups?",
  debug:
    "Case 2 expects `[1, 2]` but you returned `null`. Your loop starts `j` at `0`, so when `i == j` you can pair an element with itself. What should `j` start at?",
  complexity:
    "Your current solution:\n\n- **Time:** O(n²), two nested loops over `nums`\n- **Space:** O(1), no extra structures\n\nThe optimal approach trades space for time: **O(n) time, O(n) space**.",
  approach:
    "Let's build it step by step:\n\n1. Keep a map from **value → index** for numbers seen so far.\n2. For each `x` at index `i`, compute `need = target - x`.\n3. If `need` is in the map, you're done: return `[map[need], i]`.\n4. Otherwise store `x → i` and continue.\n\nTry writing step 3 yourself. What should happen if `need` isn't there yet?",
  solution:
    "Here's a full solution with explanation:\n\n```python\nclass Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n```\n\nOne pass, O(n) time and O(n) space. **Challenge:** close this and re-type it from memory tomorrow.",
};
