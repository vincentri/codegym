import { describe, expect, it } from "vite-plus/test";
import { formFromQuestion, questionFromForm } from "@/schemas";
import { createMockApi } from "./mock";

describe("mock question bank", () => {
  it("creates, updates and deletes your own questions", async () => {
    const api = createMockApi();
    const source = await api.getQuestion("rotate-string");
    const input = questionFromForm(formFromQuestion(source), {
      origin: "manual",
      forkedFrom: null,
    });
    const created = await api.createQuestion({ ...input, title: "My Rotation" });
    expect(created.id).toBe("my-rotation");
    expect((await api.listProblems()).some((p) => p.id === "my-rotation")).toBe(true);

    await api.updateQuestion(created.id, { ...input, title: "My Rotation v2" });
    expect((await api.getQuestion(created.id)).title).toBe("My Rotation v2");

    await api.deleteQuestions([created.id]);
    await expect(api.getQuestion(created.id)).rejects.toThrow();
  });

  it("refuses to edit or delete built-in questions", async () => {
    const api = createMockApi();
    const twoSum = await api.getQuestion("two-sum");
    const input = questionFromForm(formFromQuestion(twoSum), {
      origin: "manual",
      forkedFrom: null,
    });
    await expect(api.updateQuestion("two-sum", input)).rejects.toThrow(/read-only/);
    await expect(api.deleteQuestions(["two-sum"])).rejects.toThrow(/can't be deleted/);
  });

  it("hides questions from Problems but keeps them in the bank", async () => {
    const api = createMockApi();
    await api.setHidden(["two-sum"], true);
    expect((await api.listProblems()).some((p) => p.id === "two-sum")).toBe(false);
    expect((await api.listBankQuestions()).find((q) => q.id === "two-sum")?.hidden).toBe(true);
  });

  it("deleting a category keeps its questions", async () => {
    const api = createMockApi();
    const before = (await api.listBankQuestions()).length;
    await api.deleteCategory("warm-ups");
    expect((await api.listBankQuestions()).length).toBe(before);
    const rotate = await api.getQuestion("rotate-string");
    expect(rotate.categoryIds).not.toContain("warm-ups");
    await expect(api.deleteCategory("array")).rejects.toThrow(/Built-in/);
  });

  it("rejects duplicate category names", async () => {
    const api = createMockApi();
    await expect(
      api.saveCategory({ id: null, name: "warm-ups", color: "red", description: "" }),
    ).rejects.toThrow(/exists/);
  });

  it("study plans: reorder, next unsolved, built-ins read-only", async () => {
    const api = createMockApi();
    const plan = await api.getPlan("week-1-arrays");
    expect(plan.next?.id).toBe("contains-duplicate"); // two-sum is already solved
    const reversed = plan.items.map((p) => p.id).reverse();
    await api.setPlanItems(plan.id, reversed);
    const after = await api.getPlan(plan.id);
    expect(after.items.map((p) => p.id)).toEqual(reversed);
    expect(after.next?.id).toBe("product-of-array-except-self");
    await expect(api.setPlanItems("interview-essentials", [])).rejects.toThrow(/Built-in/);
  });

  it("reset keeps categories and study plans", async () => {
    const api = createMockApi();
    const categories = (await api.listCategories()).length;
    const plans = (await api.listPlans()).length;
    await api.resetProgress({ includeCustomProblems: true });
    expect((await api.listCategories()).length).toBe(categories);
    expect((await api.listPlans()).length).toBe(plans);
    expect((await api.getPlan("week-1-arrays")).solved).toBe(0);
  });

  it("verifies a JavaScript reference against tests", async () => {
    const api = createMockApi();
    const q = await api.getQuestion("rotate-string");
    const req = {
      signature: q.signature,
      comparator: q.comparator,
      inPlaceArg: null,
      tests: [
        { input: ["abcde", "cdeab"], expected: true },
        { input: ["abc", "acb"], expected: true },
      ],
      language: "javascript" as const,
      code: q.reference!.code,
    };
    const result = await api.verifyReference(req);
    expect(result.executed).toBe(true);
    expect(result.results.map((r) => r.passed)).toEqual([true, false]);
    expect(result.results[1]?.actual).toBe(false);

    const py = await api.verifyReference({ ...req, language: "python" });
    expect(py.executed).toBe(false);
  });
});
