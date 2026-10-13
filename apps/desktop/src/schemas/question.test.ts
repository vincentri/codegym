import { describe, expect, it } from "vite-plus/test";
import { seedQuestions } from "@/api/mock-data";
import {
  emptyQuestionForm,
  formFromQuestion,
  questionFormSchema,
  questionFromForm,
  type QuestionForm,
} from "./question";

function validForm(): QuestionForm {
  return {
    ...emptyQuestionForm(),
    title: "Sum of Array",
    categoryIds: ["array"],
    descriptionMd: "Return the sum of all numbers in the array.",
    functionName: "sumAll",
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      { inputs: [{ value: "[1,2,3]" }], expected: "6", hidden: false },
      { inputs: [{ value: "[]" }], expected: "0", hidden: true },
      { inputs: [{ value: "[-1, 1]" }], expected: "0", hidden: true },
    ],
  };
}

const issues = (form: QuestionForm) => {
  const r = questionFormSchema.safeParse(form);
  return r.success
    ? []
    : r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
};

describe("questionFormSchema", () => {
  it("accepts a complete question", () => {
    expect(issues(validForm())).toEqual([]);
  });

  it("rejects invalid identifiers", () => {
    const form = {
      ...validForm(),
      functionName: "2sum",
      params: [{ name: "my nums", type: "int[]" as const }],
    };
    const paths = issues(form).map((i) => i.path);
    expect(paths).toContain("functionName");
    expect(paths).toContain("params.0.name");
  });

  it("rejects duplicate parameter names", () => {
    const form = validForm();
    form.params = [
      { name: "a", type: "int" },
      { name: "a", type: "int" },
    ];
    form.tests = form.tests.map((t) => ({ ...t, inputs: [{ value: "1" }, { value: "2" }] }));
    expect(issues(form)).toContainEqual({
      path: "params.1.name",
      message: "Duplicate parameter name",
    });
  });

  it("checks each test value against its parameter type", () => {
    const form = validForm();
    form.tests[0]!.inputs[0]!.value = "[1, 2,";
    form.tests[1]!.inputs[0]!.value = '"text"';
    form.tests[2]!.expected = "1.5";
    expect(issues(form)).toEqual(
      expect.arrayContaining([
        { path: "tests.0.inputs.0.value", message: "Not valid JSON" },
        { path: "tests.1.inputs.0.value", message: "Expected int[]" },
        { path: "tests.2.expected", message: "Expected int" },
      ]),
    );
  });

  it("needs a visible example and at least 3 tests", () => {
    const allHidden = validForm();
    allHidden.tests = allHidden.tests.map((t) => ({ ...t, hidden: true }));
    expect(issues(allHidden).map((i) => i.path)).toContain("tests");

    const tooFew = validForm();
    tooFew.tests = tooFew.tests.slice(0, 2);
    expect(issues(tooFew)).toContainEqual({ path: "tests", message: "Add at least 3 test cases" });
  });

  it("requires in-place answers to use a void return and vice versa", () => {
    const voidReturn = { ...validForm(), returns: "void" as const };
    expect(issues(voidReturn).map((i) => i.path)).toContain("returns");

    const inPlace = { ...validForm(), inPlaceArg: "0" };
    expect(issues(inPlace).map((i) => i.path)).toContain("inPlaceArg");
  });

  it("requires a category and a real description", () => {
    const form = { ...validForm(), categoryIds: [], descriptionMd: "short" };
    const paths = issues(form).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["categoryIds", "descriptionMd"]));
  });
});

describe("form conversion", () => {
  it("round-trips a stored question through the editor form", () => {
    const original = seedQuestions().find((q) => q.id === "rotate-string")!;
    const form = formFromQuestion(original);
    expect(questionFormSchema.safeParse(form).success).toBe(true);
    const back = questionFromForm(form, { origin: "ai_imported", forkedFrom: null });
    expect(back.signature).toEqual(original.signature);
    expect(back.tests).toEqual(original.tests);
    expect(back.reference).toEqual(original.reference);
    expect(back.hints).toEqual(original.hints);
  });

  it("drops an empty reference solution", () => {
    const input = questionFromForm(validForm(), { origin: "manual", forkedFrom: null });
    expect(input.reference).toBeNull();
    expect(input.tests[0]).toEqual({ input: [[1, 2, 3]], expected: 6, hidden: false });
  });
});
