import { describe, expect, it } from "vite-plus/test";
import { answersMatch } from "./compare";

describe("answersMatch", () => {
  it("exact compares structure and order", () => {
    expect(answersMatch("exact", [1, 2], [1, 2])).toBe(true);
    expect(answersMatch("exact", [2, 1], [1, 2])).toBe(false);
  });
  it("unordered ignores top-level order", () => {
    expect(answersMatch("unordered", [2, 1], [1, 2])).toBe(true);
    expect(answersMatch("unordered", [1, 1], [1, 2])).toBe(false);
  });
  it("unorderedNested ignores order inside and between groups", () => {
    expect(answersMatch("unorderedNested", [["b", "a"], ["c"]], [["c"], ["a", "b"]])).toBe(true);
  });
  it("float allows tiny differences", () => {
    expect(answersMatch("float", 2.500001, 2.5)).toBe(true);
    expect(answersMatch("float", 2.6, 2.5)).toBe(false);
  });
});
