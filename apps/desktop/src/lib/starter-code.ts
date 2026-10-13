import type { Language, ParamType, Signature } from "@/schemas";

const PY_TYPES: Record<ParamType, string> = {
  int: "int",
  float: "float",
  bool: "bool",
  string: "str",
  "int[]": "List[int]",
  "float[]": "List[float]",
  "string[]": "List[str]",
  "bool[]": "List[bool]",
  "int[][]": "List[List[int]]",
  "string[][]": "List[List[str]]",
  "char[][]": "List[List[str]]",
  ListNode: "Optional[ListNode]",
  "ListNode[]": "List[Optional[ListNode]]",
  TreeNode: "Optional[TreeNode]",
  void: "None",
};

const GO_TYPES: Record<ParamType, string> = {
  int: "int",
  float: "float64",
  bool: "bool",
  string: "string",
  "int[]": "[]int",
  "float[]": "[]float64",
  "string[]": "[]string",
  "bool[]": "[]bool",
  "int[][]": "[][]int",
  "string[][]": "[][]string",
  "char[][]": "[][]byte",
  ListNode: "*ListNode",
  "ListNode[]": "[]*ListNode",
  TreeNode: "*TreeNode",
  void: "",
};

const TS_TYPES: Record<ParamType, string> = {
  int: "number",
  float: "number",
  bool: "boolean",
  string: "string",
  "int[]": "number[]",
  "float[]": "number[]",
  "string[]": "string[]",
  "bool[]": "boolean[]",
  "int[][]": "number[][]",
  "string[][]": "string[][]",
  "char[][]": "string[][]",
  ListNode: "ListNode | null",
  "ListNode[]": "Array<ListNode | null>",
  TreeNode: "TreeNode | null",
  void: "void",
};

const JAVA_TYPES: Record<ParamType, string> = {
  int: "int",
  float: "double",
  bool: "boolean",
  string: "String",
  "int[]": "int[]",
  "float[]": "double[]",
  "string[]": "String[]",
  "bool[]": "boolean[]",
  "int[][]": "int[][]",
  "string[][]": "String[][]",
  "char[][]": "char[][]",
  ListNode: "ListNode",
  "ListNode[]": "ListNode[]",
  TreeNode: "TreeNode",
  void: "void",
};

const CPP_TYPES: Record<ParamType, string> = {
  int: "int",
  float: "double",
  bool: "bool",
  string: "string",
  "int[]": "vector<int>",
  "float[]": "vector<double>",
  "string[]": "vector<string>",
  "bool[]": "vector<bool>",
  "int[][]": "vector<vector<int>>",
  "string[][]": "vector<vector<string>>",
  "char[][]": "vector<vector<char>>",
  ListNode: "ListNode*",
  "ListNode[]": "vector<ListNode*>",
  TreeNode: "TreeNode*",
  void: "void",
};

const RUST_TYPES: Record<ParamType, string> = {
  int: "i32",
  float: "f64",
  bool: "bool",
  string: "String",
  "int[]": "Vec<i32>",
  "float[]": "Vec<f64>",
  "string[]": "Vec<String>",
  "bool[]": "Vec<bool>",
  "int[][]": "Vec<Vec<i32>>",
  "string[][]": "Vec<Vec<String>>",
  "char[][]": "Vec<Vec<char>>",
  ListNode: "Option<Box<ListNode>>",
  "ListNode[]": "Vec<Option<Box<ListNode>>>",
  TreeNode: "Option<Rc<RefCell<TreeNode>>>",
  void: "()",
};

/** C++ takes containers by reference, like LeetCode. */
function cppParam(t: ParamType): string {
  const base = CPP_TYPES[t];
  return base.startsWith("vector") || base === "string" ? `${base}&` : base;
}

/** `twoSum` → `two_sum`, `lengthOfLIS` → `length_of_lis`, `isValidBST` → `is_valid_bst`. */
export function snakeCase(name: string): string {
  let out = "";
  for (let i = 0; i < name.length; i++) {
    const c = name[i]!;
    const prev = name[i - 1];
    const next = name[i + 1];
    if (/[A-Z]/.test(c)) {
      const boundary =
        (prev !== undefined && /[a-z0-9]/.test(prev)) ||
        (prev !== undefined && /[A-Z]/.test(prev) && next !== undefined && /[a-z]/.test(next));
      if (boundary) out += "_";
      out += c.toLowerCase();
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Starter code shown to solvers. Must match the Rust runner's `starter_code_for`
 * (crates/runner/src/starter.rs); the backend contract test compares them.
 */
export function starterCode(
  sig: Signature,
  lang: Language,
  inPlaceArg: number | null = null,
): string {
  const name = sig.functionName;
  const names = sig.params.map((p) => p.name);
  switch (lang) {
    case "python": {
      const args = ["self", ...sig.params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`)].join(", ");
      return `class Solution:\n    def ${name}(${args}) -> ${PY_TYPES[sig.returns]}:\n        pass\n`;
    }
    case "javascript": {
      const doc = sig.params.map((p) => ` * @param {${p.type}} ${p.name}`).join("\n");
      return `/**\n${doc}\n * @return {${sig.returns}}\n */\nfunction ${name}(${names.join(", ")}) {\n  \n}\n`;
    }
    case "go": {
      const args = sig.params.map((p) => `${p.name} ${GO_TYPES[p.type]}`).join(", ");
      const ret = GO_TYPES[sig.returns];
      return `func ${name}(${args})${ret ? ` ${ret}` : ""} {\n    \n}\n`;
    }
    case "typescript": {
      const args = sig.params.map((p) => `${p.name}: ${TS_TYPES[p.type]}`).join(", ");
      return `function ${name}(${args}): ${TS_TYPES[sig.returns]} {\n  \n}\n`;
    }
    case "java": {
      const args = sig.params.map((p) => `${JAVA_TYPES[p.type]} ${p.name}`).join(", ");
      return `class Solution {\n    public ${JAVA_TYPES[sig.returns]} ${name}(${args}) {\n        \n    }\n}\n`;
    }
    case "cpp": {
      const args = sig.params.map((p) => `${cppParam(p.type)} ${p.name}`).join(", ");
      return `class Solution {\npublic:\n    ${CPP_TYPES[sig.returns]} ${name}(${args}) {\n        \n    }\n};\n`;
    }
    case "rust": {
      const args = sig.params
        .map((p, i) => {
          const ty = RUST_TYPES[p.type];
          return `${snakeCase(p.name)}: ${inPlaceArg === i ? `&mut ${ty}` : ty}`;
        })
        .join(", ");
      const ret = sig.returns === "void" ? "" : ` -> ${RUST_TYPES[sig.returns]}`;
      return `impl Solution {\n    pub fn ${snakeCase(name)}(${args})${ret} {\n        \n    }\n}\n`;
    }
  }
}
