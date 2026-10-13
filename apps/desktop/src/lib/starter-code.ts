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

/** Starter code shown to solvers. The Rust runner generates the same shapes in M1. */
export function starterCode(sig: Signature, lang: Language): string {
  const names = sig.params.map((p) => p.name);
  if (lang === "python") {
    const args = ["self", ...sig.params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`)].join(", ");
    return `class Solution:\n    def ${sig.functionName}(${args}) -> ${PY_TYPES[sig.returns]}:\n        pass\n`;
  }
  if (lang === "javascript") {
    const doc = sig.params.map((p) => ` * @param {${p.type}} ${p.name}`).join("\n");
    return `/**\n${doc}\n * @return {${sig.returns}}\n */\nfunction ${sig.functionName}(${names.join(", ")}) {\n  \n}\n`;
  }
  const args = sig.params.map((p) => `${p.name} ${GO_TYPES[p.type]}`).join(", ");
  const ret = GO_TYPES[sig.returns];
  return `func ${sig.functionName}(${args})${ret ? ` ${ret}` : ""} {\n    \n}\n`;
}
