import type { Difficulty, Problem, ProblemSummary } from "@/schemas";

type Row = [id: string, title: string, difficulty: Difficulty, topics: string[]];

const ROWS: Row[] = [
  ["two-sum", "Two Sum", "easy", ["Array", "Hash Map"]],
  ["valid-parentheses", "Valid Parentheses", "easy", ["Stack", "String"]],
  ["merge-two-sorted-lists", "Merge Two Sorted Lists", "easy", ["Linked List"]],
  [
    "best-time-to-buy-and-sell-stock",
    "Best Time to Buy and Sell Stock",
    "easy",
    ["Array", "Greedy"],
  ],
  ["valid-anagram", "Valid Anagram", "easy", ["Hash Map", "String"]],
  ["binary-search", "Binary Search", "easy", ["Binary Search"]],
  ["reverse-linked-list", "Reverse Linked List", "easy", ["Linked List"]],
  ["maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "easy", ["Tree", "DFS"]],
  ["invert-binary-tree", "Invert Binary Tree", "easy", ["Tree"]],
  ["climbing-stairs", "Climbing Stairs", "easy", ["Dynamic Programming"]],
  ["contains-duplicate", "Contains Duplicate", "easy", ["Hash Map"]],
  ["move-zeroes", "Move Zeroes", "easy", ["Two Pointers"]],
  ["group-anagrams", "Group Anagrams", "medium", ["Hash Map", "String"]],
  ["top-k-frequent-elements", "Top K Frequent Elements", "medium", ["Heap", "Hash Map"]],
  [
    "product-of-array-except-self",
    "Product of Array Except Self",
    "medium",
    ["Array", "Prefix Sum"],
  ],
  [
    "longest-substring-without-repeating-characters",
    "Longest Substring Without Repeating Characters",
    "medium",
    ["Sliding Window", "Hash Map"],
  ],
  ["three-sum", "3Sum", "medium", ["Two Pointers", "Sorting"]],
  ["container-with-most-water", "Container With Most Water", "medium", ["Two Pointers"]],
  ["number-of-islands", "Number of Islands", "medium", ["Graph", "BFS"]],
  ["coin-change", "Coin Change", "medium", ["Dynamic Programming"]],
  [
    "longest-increasing-subsequence",
    "Longest Increasing Subsequence",
    "medium",
    ["Dynamic Programming", "Binary Search"],
  ],
  ["merge-intervals", "Merge Intervals", "medium", ["Intervals", "Sorting"]],
  ["kth-largest-element-in-an-array", "Kth Largest Element in an Array", "medium", ["Heap"]],
  [
    "binary-tree-level-order-traversal",
    "Binary Tree Level Order Traversal",
    "medium",
    ["Tree", "BFS"],
  ],
  ["validate-binary-search-tree", "Validate Binary Search Tree", "medium", ["Tree", "DFS"]],
  ["course-schedule", "Course Schedule", "medium", ["Graph", "Topological Sort"]],
  ["search-in-rotated-sorted-array", "Search in Rotated Sorted Array", "medium", ["Binary Search"]],
  ["daily-temperatures", "Daily Temperatures", "medium", ["Monotonic Stack"]],
  ["word-break", "Word Break", "medium", ["Dynamic Programming"]],
  ["edit-distance", "Edit Distance", "medium", ["Dynamic Programming"]],
  ["trapping-rain-water", "Trapping Rain Water", "hard", ["Two Pointers", "Monotonic Stack"]],
  ["median-of-two-sorted-arrays", "Median of Two Sorted Arrays", "hard", ["Binary Search"]],
  ["merge-k-sorted-lists", "Merge k Sorted Lists", "hard", ["Heap", "Linked List"]],
  ["minimum-window-substring", "Minimum Window Substring", "hard", ["Sliding Window"]],
];

const SOLVED = new Set([
  "two-sum",
  "valid-parentheses",
  "climbing-stairs",
  "binary-search",
  "group-anagrams",
]);
const ATTEMPTED = new Set(["longest-substring-without-repeating-characters", "coin-change"]);

export const MOCK_SUMMARIES: ProblemSummary[] = ROWS.map(([id, title, difficulty, topics], i) => ({
  id,
  number: i + 1,
  title,
  difficulty,
  topics,
  source: "builtin",
  status: SOLVED.has(id) ? "solved" : ATTEMPTED.has(id) ? "attempted" : "todo",
}));

MOCK_SUMMARIES.push({
  id: "custom-rotate-string",
  number: MOCK_SUMMARIES.length + 1,
  title: "Rotate String (imported)",
  difficulty: "easy",
  topics: ["String", "Custom"],
  source: "custom",
  status: "todo",
});

const DETAILS: Record<string, Omit<Problem, keyof ProblemSummary>> = {
  "two-sum": {
    descriptionMd: `You are given an array of integers \`nums\` and an integer \`target\`.

Return the **indices of the two numbers** that add up to \`target\`. Each input has exactly one valid answer, and you may not use the same element twice. The two indices can be returned in any order.

**Example 1**

\`\`\`
nums = [2, 7, 11, 15], target = 9
→ [0, 1]
\`\`\`
Because \`nums[0] + nums[1] == 9\`.

**Example 2**

\`\`\`
nums = [3, 2, 4], target = 6
→ [1, 2]
\`\`\`

**Follow-up:** can you do better than checking every pair (O(n²))?`,
    constraints: [
      "2 ≤ nums.length ≤ 10⁴",
      "-10⁹ ≤ nums[i], target ≤ 10⁹",
      "Exactly one valid answer exists.",
    ],
    signature: {
      functionName: "twoSum",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[]",
    },
    comparator: "unordered",
    inPlaceArg: null,
    examples: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1], hidden: false },
      { input: [[3, 2, 4], 6], expected: [1, 2], hidden: false },
      { input: [[3, 3], 6], expected: [0, 1], hidden: false },
    ],
    hiddenTestCount: 7,
  },
  "valid-parentheses": {
    descriptionMd: `Given a string \`s\` made only of the characters \`()[]{}\`, decide whether it is **balanced**:

- every opening bracket is closed by the same kind of bracket, and
- brackets close in the correct order.

**Example**

\`\`\`
s = "([]{})"  → true
s = "(]"      → false
\`\`\``,
    constraints: ["1 ≤ s.length ≤ 10⁴", "s contains only ()[]{}"],
    signature: {
      functionName: "isValid",
      params: [{ name: "s", type: "string" }],
      returns: "bool",
    },
    comparator: "exact",
    inPlaceArg: null,
    examples: [
      { input: ["([]{})"], expected: true, hidden: false },
      { input: ["(]"], expected: false, hidden: false },
    ],
    hiddenTestCount: 8,
  },
  "merge-k-sorted-lists": {
    descriptionMd: `You are given an array of \`k\` linked lists, each sorted in ascending order.

Merge them into **one sorted linked list** and return its head.

**Example**

\`\`\`
lists = [[1,4,5],[1,3,4],[2,6]]
→ [1,1,2,3,4,4,5,6]
\`\`\``,
    constraints: [
      "0 ≤ k ≤ 10⁴",
      "0 ≤ lists[i].length ≤ 500",
      "The total number of nodes is at most 10⁴.",
    ],
    signature: {
      functionName: "mergeKLists",
      params: [{ name: "lists", type: "ListNode[]" }],
      returns: "ListNode",
    },
    comparator: "exact",
    inPlaceArg: null,
    examples: [
      {
        input: [
          [
            [1, 4, 5],
            [1, 3, 4],
            [2, 6],
          ],
        ],
        expected: [1, 1, 2, 3, 4, 4, 5, 6],
        hidden: false,
      },
      { input: [[]], expected: [], hidden: false },
    ],
    hiddenTestCount: 6,
  },
};

export function mockProblem(summary: ProblemSummary): Problem {
  const detail = DETAILS[summary.id] ?? {
    descriptionMd: `*This is a prototype.* The full statement for **${summary.title}** ships with the real question bank in the next milestone.

The workspace, editor, test runner and mentor all behave the same for every problem.`,
    constraints: ["See the full question bank in milestone 1."],
    signature: { functionName: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    comparator: "exact",
    inPlaceArg: null,
    examples: [{ input: [[1, 2, 3]], expected: 6, hidden: false }],
    hiddenTestCount: 5,
  };
  return { ...summary, ...detail };
}
