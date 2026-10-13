import type {
  CategoryColor,
  Difficulty,
  GeneratedQuestion,
  Problem,
  ProblemSummary,
  QuestionRecord,
  TestCase,
} from "@/schemas";

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

export const SEED_SOLVED = new Set([
  "two-sum",
  "valid-parentheses",
  "climbing-stairs",
  "binary-search",
  "group-anagrams",
]);
export const SEED_ATTEMPTED = new Set([
  "longest-substring-without-repeating-characters",
  "coin-change",
]);

type DetailSeed = Omit<Problem, keyof ProblemSummary>;

const DETAILS: Record<string, DetailSeed> = {
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

const GENERIC: DetailSeed = {
  descriptionMd: `*This is a prototype.* The full statement for this problem ships with the real question bank in the next milestone.

The workspace, editor, test runner and mentor all behave the same for every problem.`,
  constraints: ["See the full question bank in milestone 1."],
  signature: { functionName: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" },
  comparator: "exact",
  inPlaceArg: null,
  examples: [{ input: [[1, 2, 3]], expected: 6, hidden: false }],
  hiddenTestCount: 5,
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const TOPIC_COLORS: Record<string, CategoryColor> = {
  Array: "blue",
  "Hash Map": "teal",
  String: "violet",
  Stack: "orange",
  "Linked List": "pink",
  Tree: "green",
  DFS: "green",
  BFS: "teal",
  Graph: "amber",
  "Dynamic Programming": "red",
  "Binary Search": "blue",
  "Two Pointers": "orange",
  "Sliding Window": "violet",
  Heap: "amber",
};

export interface CategoryRecord {
  id: string;
  name: string;
  color: CategoryColor;
  description: string;
  builtin: boolean;
}

export function seedCategories(): CategoryRecord[] {
  const builtin = [...new Set(ROWS.flatMap((r) => r[3]))].map((name) => ({
    id: slugify(name),
    name,
    color: TOPIC_COLORS[name] ?? "slate",
    description: "",
    builtin: true,
  }));
  return [
    ...builtin,
    {
      id: "warm-ups",
      name: "Warm-ups",
      color: "green",
      description: "Quick problems to start a session.",
      builtin: false,
    },
  ];
}

/** Two Sum gets real hidden tests so the editor's Verify button has something to check. */
const TWO_SUM_HIDDEN: TestCase[] = [
  { input: [[1, 5, 3, 7], 8], expected: [1, 2], hidden: true },
  { input: [[-3, 4, 3, 90], 0], expected: [0, 2], hidden: true },
  { input: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
];

function testsFor(id: string, d: DetailSeed): TestCase[] {
  if (id === "two-sum") return [...d.examples, ...TWO_SUM_HIDDEN];
  const hidden = Array.from({ length: d.hiddenTestCount }, (_, i) => ({
    ...d.examples[i % d.examples.length]!,
    hidden: true,
  }));
  return [...d.examples, ...hidden];
}

const TWO_SUM_REFERENCE = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
}
`;

export function seedQuestions(): QuestionRecord[] {
  const builtins: QuestionRecord[] = ROWS.map(([id, title, difficulty, topics]) => {
    const d = DETAILS[id] ?? GENERIC;
    return {
      id,
      title,
      difficulty,
      categoryIds: topics.map(slugify),
      descriptionMd: d.descriptionMd,
      constraints: d.constraints,
      hints: [],
      signature: d.signature,
      comparator: d.comparator,
      inPlaceArg: d.inPlaceArg,
      tests: testsFor(id, d),
      reference: id === "two-sum" ? { language: "javascript", code: TWO_SUM_REFERENCE } : null,
      origin: "builtin",
      forkedFrom: null,
    };
  });
  const rotateString: QuestionRecord = {
    id: "rotate-string",
    title: "Rotate String",
    difficulty: "easy",
    categoryIds: ["string", "warm-ups"],
    descriptionMd: `Given two strings \`s\` and \`goal\`, return \`true\` if \`s\` can become \`goal\` after some number of **left rotations**. A left rotation moves the first character to the end.

\`\`\`
s = "abcde", goal = "cdeab" → true
s = "abcde", goal = "abced" → false
\`\`\``,
    constraints: ["1 ≤ s.length, goal.length ≤ 100", "Lowercase English letters only"],
    hints: ["What string contains every rotation of s?"],
    signature: {
      functionName: "rotateString",
      params: [
        { name: "s", type: "string" },
        { name: "goal", type: "string" },
      ],
      returns: "bool",
    },
    comparator: "exact",
    inPlaceArg: null,
    tests: [
      { input: ["abcde", "cdeab"], expected: true, hidden: false },
      { input: ["abcde", "abced"], expected: false, hidden: false },
      { input: ["a", "a"], expected: true, hidden: true },
      { input: ["ab", "abc"], expected: false, hidden: true },
    ],
    reference: {
      language: "javascript",
      code: "function rotateString(s, goal) {\n  return s.length === goal.length && (s + s).includes(goal);\n}\n",
    },
    origin: "ai_imported",
    forkedFrom: null,
  };
  return [...builtins, rotateString];
}

export interface PlanRecord {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  problemIds: string[];
  updatedAt: string;
}

export function seedPlans(): PlanRecord[] {
  const now = Date.now();
  return [
    {
      id: "interview-essentials",
      name: "Interview Essentials",
      description:
        "The built-in question bank in a sensible order: easy warm-ups first, then the classic patterns.",
      builtin: true,
      problemIds: ROWS.map((r) => r[0]),
      updatedAt: new Date(now - 3 * 86_400_000).toISOString(),
    },
    {
      id: "week-1-arrays",
      name: "Week 1: Arrays & Hashing",
      description: "My first week: get comfortable with arrays and hash maps.",
      builtin: false,
      problemIds: [
        "two-sum",
        "contains-duplicate",
        "valid-anagram",
        "group-anagrams",
        "top-k-frequent-elements",
        "product-of-array-except-self",
      ],
      updatedAt: new Date(now - 3_600_000).toISOString(),
    },
  ];
}

/** Canned results for "Generate with AI" in the prototype. */
export function cannedGenerated(topicId: string, difficulty: Difficulty): GeneratedQuestion[] {
  const base = {
    difficulty,
    categoryIds: [topicId],
    constraints: ["1 ≤ nums.length ≤ 10⁵", "-10⁴ ≤ nums[i] ≤ 10⁴"],
    hints: [],
    comparator: "exact" as const,
    inPlaceArg: null,
    origin: "ai_generated" as const,
    forkedFrom: null,
  };
  return [
    {
      verifiedTests: 10,
      droppedTests: 0,
      question: {
        ...base,
        title: "Longest Run of Equal Neighbors",
        descriptionMd:
          "Given an integer array `nums`, return the length of the longest contiguous block where every element equals its neighbour.\n\n```\nnums = [1,1,2,2,2,3] → 3\n```",
        signature: {
          functionName: "longestRun",
          params: [{ name: "nums", type: "int[]" }],
          returns: "int",
        },
        tests: [
          { input: [[1, 1, 2, 2, 2, 3]], expected: 3, hidden: false },
          { input: [[5]], expected: 1, hidden: false },
          { input: [[1, 2, 3]], expected: 1, hidden: true },
          { input: [[7, 7, 7, 7]], expected: 4, hidden: true },
        ],
        reference: {
          language: "javascript",
          code: "function longestRun(nums) {\n  let best = 1, run = 1;\n  for (let i = 1; i < nums.length; i++) {\n    run = nums[i] === nums[i - 1] ? run + 1 : 1;\n    best = Math.max(best, run);\n  }\n  return best;\n}\n",
        },
      },
    },
    {
      verifiedTests: 9,
      droppedTests: 1,
      question: {
        ...base,
        title: "Balanced Split Point",
        descriptionMd:
          "Return the smallest index `i` such that the sum of `nums[0..i]` equals the sum of `nums[i+1..]`, or `-1` if there is none.\n\n```\nnums = [1,2,3,3] → 2\n```",
        signature: {
          functionName: "splitPoint",
          params: [{ name: "nums", type: "int[]" }],
          returns: "int",
        },
        tests: [
          { input: [[1, 2, 3, 3]], expected: 2, hidden: false },
          { input: [[1, 1]], expected: 0, hidden: false },
          { input: [[1, 2]], expected: -1, hidden: true },
        ],
        reference: {
          language: "javascript",
          code: "function splitPoint(nums) {\n  const total = nums.reduce((a, b) => a + b, 0);\n  let left = 0;\n  for (let i = 0; i < nums.length - 1; i++) {\n    left += nums[i];\n    if (left * 2 === total) return i;\n  }\n  return -1;\n}\n",
        },
      },
    },
  ];
}
