import { z } from "zod";
import type { ParamType, Signature } from "./problem";

const int = z.number().int("Expected an integer");
const listNode = z.array(int);
// Level-order tree with nulls for missing children, e.g. [3,9,20,null,null,15,7].
const treeNode = z.array(int.nullable());

/** Zod schema for a decoded JSON value of the given parameter type. */
export function valueSchemaFor(type: ParamType): z.ZodType {
  switch (type) {
    case "int":
      return int;
    case "float":
      return z.number();
    case "bool":
      return z.boolean();
    case "string":
      return z.string();
    case "int[]":
      return z.array(int);
    case "float[]":
      return z.array(z.number());
    case "string[]":
      return z.array(z.string());
    case "bool[]":
      return z.array(z.boolean());
    case "int[][]":
      return z.array(z.array(int));
    case "string[][]":
      return z.array(z.array(z.string()));
    case "char[][]":
      return z.array(z.array(z.string().length(1, "Each cell must be a single character")));
    case "ListNode":
      return listNode;
    case "ListNode[]":
      return z.array(listNode);
    case "TreeNode":
      return treeNode;
    case "void":
      return z.null();
  }
}

export function placeholderFor(type: ParamType): string {
  switch (type) {
    case "int":
      return "5";
    case "float":
      return "2.5";
    case "bool":
      return "true";
    case "string":
      return '"abc"';
    case "int[]":
    case "ListNode":
      return "[1,2,3]";
    case "float[]":
      return "[1.5,2.0]";
    case "string[]":
      return '["a","b"]';
    case "bool[]":
      return "[true,false]";
    case "int[][]":
    case "ListNode[]":
      return "[[1,2],[3]]";
    case "string[][]":
      return '[["a"],["b","c"]]';
    case "char[][]":
      return '[["1","0"],["0","1"]]';
    case "TreeNode":
      return "[3,9,20,null,null,15,7]";
    case "void":
      return "null";
  }
}

/**
 * Builds the form schema for adding a custom test case. Each parameter is typed in as JSON text;
 * the schema parses it and checks it against the parameter's type.
 */
export function customInputFormSchema(signature: Signature) {
  const shape: Record<string, z.ZodString> = {};
  for (const param of signature.params) {
    const valueSchema = valueSchemaFor(param.type);
    shape[param.name] = z
      .string()
      .trim()
      .min(1, `Enter a value for ${param.name}`)
      .superRefine((text, ctx) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          ctx.addIssue({ code: "custom", message: "Not valid JSON" });
          return;
        }
        const result = valueSchema.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: "custom",
            message: `Expected ${param.type}: ${result.error.issues[0]?.message ?? "invalid value"}`,
          });
        }
      });
  }
  return z.object(shape);
}

export function customInputToArgs(signature: Signature, values: Record<string, string>): unknown[] {
  return signature.params.map((p) => JSON.parse(values[p.name] ?? "null") as unknown);
}
