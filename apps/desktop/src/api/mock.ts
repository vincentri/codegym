import { answersMatch } from "@/lib/compare";
import { starterCode } from "@/lib/starter-code";
import type {
  AiProfile,
  AiProfileForm,
  AppSettings,
  BankQuestion,
  Category,
  ChatMessage,
  Dashboard,
  Draft,
  GeneratedQuestion,
  Language,
  PlanSummary,
  Problem,
  ProblemSummary,
  QuestionInput,
  QuestionRecord,
  RunRequest,
  RunResult,
  Submission,
  TestResult,
} from "@/schemas";
import {
  cannedGenerated,
  type CategoryRecord,
  type PlanRecord,
  SEED_ATTEMPTED,
  SEED_SOLVED,
  seedCategories,
  seedPlans,
  seedQuestions,
  slugify,
} from "./mock-data";
import { MENTOR_REPLIES } from "./mock-replies";
import type { CodegymApi, MentorRequest, VerifyRequest } from "./types";

// In-memory backend used by the browser prototype and by tests. Milestone 1 replaces it with
// Rust commands behind the same interface.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
let idCounter = 1;
const newId = (prefix = "mock") => `${prefix}-${idCounter++}`;

/** Types the prototype can't build in the browser (linked lists, trees). */
const STRUCTURED = /ListNode|TreeNode/;

/**
 * Runs a JavaScript reference solution in the browser for the prototype's Verify button.
 * The desktop app runs every language in its sandboxed runner instead.
 */
function runJsReference(req: VerifyRequest) {
  // Prototype only: evaluates the author's own reference code in their own browser.
  // oxlint-disable-next-line typescript/no-implied-eval
  const fn = new Function(`${req.code}\nreturn ${req.signature.functionName};`)() as unknown;
  if (typeof fn !== "function") {
    throw new Error(`Define a function named ${req.signature.functionName}`);
  }
  return req.tests.map((t, index) => {
    try {
      const args = structuredClone(t.input);
      const returned = (fn as (...a: unknown[]) => unknown)(...args);
      const actual = req.inPlaceArg === null ? returned : args[req.inPlaceArg];
      return {
        index,
        actual: actual === undefined ? null : actual,
        passed: answersMatch(req.comparator, actual, t.expected),
        error: null,
      };
    } catch (e) {
      return {
        index,
        actual: null,
        passed: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}

export function createMockApi(): CodegymApi {
  let settings: AppSettings = {
    theme: "dark",
    defaultLanguage: "python",
    editorFontSize: 14,
    editorTabSize: 4,
    autosaveSeconds: 5,
    runTimeoutSeconds: 10,
  };

  // Each mock instance gets its own copy so tests do not share state.
  let questions: QuestionRecord[] = seedQuestions();
  let categories: CategoryRecord[] = seedCategories();
  let plans: PlanRecord[] = seedPlans();
  const status = new Map<string, ProblemSummary["status"]>();
  for (const id of SEED_SOLVED) status.set(id, "solved");
  for (const id of SEED_ATTEMPTED) status.set(id, "attempted");
  const hidden = new Set<string>();
  const updatedAt = new Map<string, string>();
  const verified = new Set<string>(["two-sum", "rotate-string"]);
  let streakDays = 3;

  const drafts = new Map<string, Draft>();
  const chats = new Map<string, ChatMessage[]>();
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const seed = (
    problemId: string,
    language: Language,
    verdict: Submission["verdict"],
    passed: number,
    total: number,
    createdAt: string,
  ): Submission => ({
    id: newId(),
    problemId,
    language,
    verdict,
    passed,
    total,
    runtimeMs: verdict === "accepted" ? 14 : null,
    createdAt,
    code: "",
  });
  // Sample history so the prototype dashboard is not empty.
  let submissions: Submission[] = [
    seed("coin-change", "go", "wrong_answer", 6, 10, minutesAgo(25)),
    seed(
      "longest-substring-without-repeating-characters",
      "python",
      "time_limit",
      7,
      10,
      minutesAgo(90),
    ),
    seed("group-anagrams", "python", "accepted", 10, 10, minutesAgo(60 * 20)),
    seed("binary-search", "javascript", "accepted", 8, 8, minutesAgo(60 * 26)),
    seed("climbing-stairs", "python", "accepted", 9, 9, minutesAgo(60 * 50)),
  ];

  let profiles: AiProfile[] = [
    {
      id: "p-ollama",
      name: "Ollama (local)",
      provider: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5-coder:7b",
      effort: "medium",
      mentorStyle: "socratic",
      hasApiKey: false,
      isActive: true,
    },
    {
      id: "p-zen",
      name: "OpenCode Zen",
      provider: "opencode_zen",
      baseUrl: "https://opencode.ai/zen/v1",
      model: "big-pickle",
      effort: "medium",
      mentorStyle: "socratic",
      hasApiKey: true,
      isActive: false,
    },
  ];

  // --- helpers --------------------------------------------------------------

  const findQuestion = (id: string) => {
    const q = questions.find((x) => x.id === id);
    if (!q) throw new Error(`Unknown question: ${id}`);
    return q;
  };

  const summary = (q: QuestionRecord): ProblemSummary => ({
    id: q.id,
    number: questions.indexOf(q) + 1,
    title: q.title,
    difficulty: q.difficulty,
    categories: q.categoryIds
      .map((cid) => categories.find((c) => c.id === cid))
      .filter((c): c is CategoryRecord => !!c)
      .map((c) => ({ id: c.id, name: c.name, color: c.color })),
    origin: q.origin,
    hidden: hidden.has(q.id),
    status: status.get(q.id) ?? "todo",
  });

  const toProblem = (q: QuestionRecord): Problem => ({
    ...summary(q),
    descriptionMd: q.descriptionMd,
    constraints: q.constraints,
    signature: q.signature,
    comparator: q.comparator,
    inPlaceArg: q.inPlaceArg,
    examples: q.tests.filter((t) => !t.hidden),
    hiddenTestCount: q.tests.filter((t) => t.hidden).length,
  });

  const planSummary = (p: PlanRecord): PlanSummary => {
    const items = p.problemIds
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is QuestionRecord => !!q);
    const next = items.find((q) => status.get(q.id) !== "solved");
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      builtin: p.builtin,
      solved: items.filter((q) => status.get(q.id) === "solved").length,
      total: items.length,
      next: next ? summary(next) : null,
      updatedAt: p.updatedAt,
    };
  };

  const findPlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown study plan: ${id}`);
    return p;
  };

  const editablePlan = (id: string) => {
    const p = findPlan(id);
    if (p.builtin) throw new Error("Built-in plans can't be changed. Duplicate it first.");
    return p;
  };

  const touchPlan = (p: PlanRecord) => {
    p.updatedAt = now();
  };

  const categoryRow = (c: CategoryRecord): Category => {
    const tagged = questions.filter((q) => q.categoryIds.includes(c.id));
    return {
      ...c,
      questionCount: tagged.length,
      solvedCount: tagged.filter((q) => status.get(q.id) === "solved").length,
    };
  };

  const removeQuestionData = (ids: Set<string>) => {
    questions = questions.filter((q) => !ids.has(q.id));
    submissions = submissions.filter((s) => !ids.has(s.problemId));
    for (const key of [...drafts.keys()]) if (ids.has(key.split(":")[0]!)) drafts.delete(key);
    for (const id of ids) {
      chats.delete(id);
      status.delete(id);
      hidden.delete(id);
    }
    for (const p of plans) p.problemIds = p.problemIds.filter((id) => !ids.has(id));
  };

  const fakeRun = async (req: RunRequest, includeHidden: boolean): Promise<RunResult> => {
    await sleep(500);
    const q = findQuestion(req.problemId);
    const starter = starterCode(q.signature, req.language);
    const attempted = req.code.trim() !== starter.trim() && /return/.test(req.code);
    const results: TestResult[] = [];
    for (const t of q.tests.filter((t) => includeHidden || !t.hidden)) {
      results.push({
        index: results.length,
        hidden: t.hidden,
        custom: false,
        input: t.hidden ? null : t.input,
        expected: t.hidden ? null : t.expected,
        actual: attempted && !t.hidden ? t.expected : null,
        passed: attempted,
        stdout: results.length === 0 && attempted ? "debug: checking pair\n" : "",
        error: null,
        timeMs: 1 + results.length,
      });
    }
    for (const input of req.customInputs) {
      results.push({
        index: results.length,
        hidden: false,
        custom: true,
        input,
        expected: null,
        actual: attempted ? [0, 1] : null,
        passed: null,
        stdout: "",
        error: null,
        timeMs: 1,
      });
    }
    const graded = results.filter((r) => r.passed !== null);
    const passed = graded.filter((r) => r.passed).length;
    return {
      verdict: passed === graded.length ? "accepted" : "wrong_answer",
      passed,
      total: graded.length,
      results,
      compileOutput: null,
      totalTimeMs: results.reduce((s, r) => s + r.timeMs, 0),
    };
  };

  const createRecord = (input: QuestionInput): QuestionRecord => {
    const base = slugify(input.title) || "question";
    let id = base;
    for (let n = 2; questions.some((q) => q.id === id); n++) id = `${base}-${n}`;
    const record: QuestionRecord = { ...input, id };
    questions.push(record);
    updatedAt.set(id, now());
    if (input.reference) verified.add(id);
    return record;
  };

  // --- API ------------------------------------------------------------------

  return {
    async listProblems() {
      await sleep(80);
      return questions.filter((q) => !hidden.has(q.id)).map(summary);
    },
    async getProblem(id) {
      await sleep(60);
      return toProblem(findQuestion(id));
    },
    async getStats() {
      const byDifficulty = {
        easy: { solved: 0, total: 0 },
        medium: { solved: 0, total: 0 },
        hard: { solved: 0, total: 0 },
      };
      const visible = questions.filter((q) => !hidden.has(q.id));
      for (const q of visible) {
        byDifficulty[q.difficulty].total++;
        if (status.get(q.id) === "solved") byDifficulty[q.difficulty].solved++;
      }
      return {
        solved: visible.filter((q) => status.get(q.id) === "solved").length,
        total: visible.length,
        byDifficulty,
        streakDays,
      };
    },
    async getDashboard() {
      await sleep(80);
      const title = (id: string) => questions.find((q) => q.id === id)?.title ?? id;
      const lastAttempt = submissions.find((s) => status.get(s.problemId) === "attempted");
      const continueQ = lastAttempt ? questions.find((q) => q.id === lastAttempt.problemId) : null;
      const continueProblem =
        lastAttempt && continueQ
          ? {
              problem: summary(continueQ),
              attempts: submissions.filter((s) => s.problemId === lastAttempt.problemId).length,
              language: lastAttempt.language,
              lastActiveAt: lastAttempt.createdAt,
            }
          : null;

      let suggestion: Dashboard["suggestion"] = null;
      for (const c of categories.filter((c) => c.builtin)) {
        const list = questions.filter(
          (q) => q.origin === "builtin" && !hidden.has(q.id) && q.categoryIds.includes(c.id),
        );
        const unsolved = list.filter((q) => status.get(q.id) !== "solved");
        if (list.length < 3 || unsolved.length === 0) continue;
        const solved = list.length - unsolved.length;
        if (!suggestion || solved / list.length < suggestion.solved / suggestion.total) {
          suggestion = {
            topic: c.name,
            solved,
            total: list.length,
            problems: unsolved.slice(0, 3).map(summary),
          };
        }
      }
      const recentPlan = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return {
        continueProblem,
        plan: recentPlan ? planSummary(recentPlan) : null,
        recentSubmissions: submissions
          .slice(0, 6)
          .map((s) => ({ ...s, problemTitle: title(s.problemId) })),
        suggestion,
      };
    },
    async resetProgress({ includeCustomProblems }) {
      await sleep(300);
      submissions = [];
      drafts.clear();
      chats.clear();
      status.clear();
      streakDays = 0;
      if (includeCustomProblems) {
        removeQuestionData(
          new Set(questions.filter((q) => q.origin !== "builtin").map((q) => q.id)),
        );
      }
    },
    async getDraft(problemId, language) {
      return drafts.get(`${problemId}:${language}`) ?? null;
    },
    async saveDraft(problemId, language, code) {
      const draft = { problemId, language, code, updatedAt: now() };
      drafts.set(`${problemId}:${language}`, draft);
      return draft;
    },
    async starterCode(problemId, language) {
      return starterCode(findQuestion(problemId).signature, language);
    },
    runCode: (req) => fakeRun(req, false),
    async submitCode(req) {
      const run = await fakeRun({ ...req, customInputs: [] }, true);
      const firstSolve =
        run.verdict === "accepted" &&
        !submissions.some((s) => s.problemId === req.problemId && s.verdict === "accepted");
      const submission: Submission = {
        id: newId(),
        problemId: req.problemId,
        language: req.language,
        verdict: run.verdict,
        passed: run.passed,
        total: run.total,
        runtimeMs: run.totalTimeMs,
        createdAt: now(),
        code: req.code,
      };
      submissions.unshift(submission);
      if (run.verdict === "accepted") status.set(req.problemId, "solved");
      else if (status.get(req.problemId) !== "solved") status.set(req.problemId, "attempted");
      return { run, submission, firstSolve };
    },
    async listSubmissions(problemId) {
      return submissions.filter((s) => s.problemId === problemId);
    },
    async recordActivity() {},
    async getSettings() {
      return settings;
    },
    async updateSettings(next) {
      settings = next;
      return settings;
    },
    async detectRuntimes() {
      await sleep(150);
      return [
        {
          language: "python",
          engine: "CPython 3.13 (WebAssembly, bundled)",
          version: "3.13.5",
          available: true,
          bundled: true,
          installHint: null,
        },
        {
          language: "javascript",
          engine: "Node.js (system)",
          version: "22.22.0",
          available: true,
          bundled: false,
          installHint: null,
        },
        {
          language: "go",
          engine: "Go toolchain (system)",
          version: null,
          available: false,
          bundled: false,
          installHint: "Install Go from https://go.dev/dl/ and restart CodeGym.",
        },
      ];
    },
    async dataInfo() {
      return {
        dbPath: "~/.local/share/com.codegym.app/codegym.db",
        builtinProblems: questions.filter((q) => q.origin === "builtin").length,
        customProblems: questions.filter((q) => q.origin !== "builtin").length,
        bankVersion: "2026.10.0",
      };
    },
    async openDataFolder() {
      throw new Error("Opening the data folder works in the desktop app.");
    },
    async listAiProfiles() {
      return profiles;
    },
    async saveAiProfile(form: AiProfileForm) {
      await sleep(200);
      const existing = form.id ? profiles.find((p) => p.id === form.id) : undefined;
      const profile: AiProfile = {
        id: existing?.id ?? newId(),
        name: form.name,
        provider: form.provider,
        baseUrl: form.baseUrl,
        model: form.model,
        effort: form.effort,
        mentorStyle: form.mentorStyle,
        hasApiKey: form.apiKey !== "" || form.hasStoredKey,
        isActive: existing?.isActive ?? profiles.length === 0,
      };
      profiles = existing
        ? profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...profiles, profile];
      return profile;
    },
    async deleteAiProfile(id) {
      profiles = profiles.filter((p) => p.id !== id);
    },
    async setActiveAiProfile(id) {
      profiles = profiles.map((p) => ({ ...p, isActive: p.id === id }));
    },
    async listModels(form) {
      await sleep(400);
      switch (form.provider) {
        case "ollama":
          return ["qwen2.5-coder:7b", "qwen2.5-coder:14b", "llama3.1:8b", "deepseek-coder-v2:16b"];
        case "opencode_zen":
          return ["big-pickle", "deepseek-v4-flash-free", "qwen3.6-plus-free"];
        case "anthropic":
          return ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
        case "custom":
          return [];
      }
    },
    async testConnection(form) {
      await sleep(500);
      if (form.provider === "custom" && form.baseUrl.includes("example")) {
        return { ok: false, latencyMs: null, error: "Could not connect: connection refused" };
      }
      return { ok: true, latencyMs: 420, error: null };
    },
    async listChat(problemId) {
      return chats.get(problemId) ?? [];
    },
    async clearChat(problemId) {
      chats.delete(problemId);
    },
    async sendMentorMessage(req: MentorRequest, onEvent, signal) {
      const history = chats.get(req.problemId) ?? [];
      history.push({
        id: newId(),
        problemId: req.problemId,
        role: "user",
        mode: req.mode,
        content: req.message,
        createdAt: now(),
      });
      chats.set(req.problemId, history);
      const reply = MENTOR_REPLIES[req.mode];
      let sent = "";
      for (const chunk of reply.match(/[\s\S]{1,6}/g) ?? []) {
        if (signal.aborted) break;
        await sleep(18);
        sent += chunk;
        onEvent({ type: "delta", text: chunk });
      }
      const message: ChatMessage = {
        id: newId(),
        problemId: req.problemId,
        role: "assistant",
        mode: req.mode,
        content: sent,
        createdAt: now(),
      };
      history.push(message);
      onEvent({ type: "done", message });
    },
    async importProblem(text) {
      await sleep(1200);
      const [sample] = cannedGenerated("array", "easy");
      const firstLine = text.trim().split("\n")[0]?.slice(0, 60) || "Imported problem";
      return {
        ...sample!,
        question: { ...sample!.question, title: firstLine, origin: "ai_imported" },
      };
    },

    // --- Question Bank --------------------------------------------------------

    async listBankQuestions() {
      await sleep(80);
      return questions.map((q): BankQuestion => ({
        ...summary(q),
        testCount: q.tests.length,
        verified: verified.has(q.id),
        updatedAt: updatedAt.get(q.id) ?? "2026-10-01T00:00:00.000Z",
      }));
    },
    async getQuestion(id) {
      await sleep(60);
      return structuredClone(findQuestion(id));
    },
    async createQuestion(input) {
      await sleep(200);
      return structuredClone(createRecord(structuredClone(input)));
    },
    async updateQuestion(id, input) {
      await sleep(200);
      const q = findQuestion(id);
      if (q.origin === "builtin") {
        throw new Error("Built-in questions are read-only. Duplicate it to edit.");
      }
      Object.assign(q, structuredClone(input), { id, origin: q.origin });
      updatedAt.set(id, now());
      if (input.reference) verified.add(id);
      else verified.delete(id);
      return structuredClone(q);
    },
    async deleteQuestions(ids) {
      await sleep(200);
      if (ids.some((id) => findQuestion(id).origin === "builtin")) {
        throw new Error("Built-in questions can't be deleted. Hide them instead.");
      }
      removeQuestionData(new Set(ids));
    },
    async setHidden(ids, value) {
      for (const id of ids) {
        if (value) hidden.add(id);
        else hidden.delete(id);
      }
    },
    async verifyReference(req) {
      await sleep(400);
      const types = [...req.signature.params.map((p) => p.type), req.signature.returns];
      if (req.language !== "javascript" || types.some((t) => STRUCTURED.test(t))) {
        return {
          executed: false,
          note:
            req.language !== "javascript"
              ? "The prototype only runs JavaScript. Python and Go references run in the desktop app."
              : "Linked lists and trees are built by the desktop app's runner, not the prototype.",
          results: [],
        };
      }
      return { executed: true, note: null, results: runJsReference(req) };
    },
    async generateQuestions(req, onProgress) {
      for (const step of ["writing", "testing", "verifying"] as const) {
        onProgress(step);
        await sleep(700);
      }
      onProgress("done");
      const category = categories.find(
        (c) => c.name.toLowerCase() === req.topic.trim().toLowerCase(),
      );
      const generated: GeneratedQuestion[] = cannedGenerated(
        category?.id ?? "array",
        req.difficulty,
      );
      return generated.slice(0, req.count);
    },

    // --- Categories -----------------------------------------------------------

    async listCategories() {
      return categories.map(categoryRow);
    },
    async saveCategory(form) {
      await sleep(150);
      const clash = categories.find(
        (c) => c.id !== form.id && c.name.toLowerCase() === form.name.trim().toLowerCase(),
      );
      if (clash) throw new Error("A category with this name exists");
      if (form.id) {
        const c = categories.find((x) => x.id === form.id);
        if (!c) throw new Error("Unknown category");
        if (c.builtin) throw new Error("Built-in categories can't be changed");
        Object.assign(c, {
          name: form.name.trim(),
          color: form.color,
          description: form.description,
        });
        return categoryRow(c);
      }
      let id = slugify(form.name) || "category";
      while (categories.some((c) => c.id === id)) id = `${id}-x`;
      const record: CategoryRecord = {
        id,
        name: form.name.trim(),
        color: form.color,
        description: form.description,
        builtin: false,
      };
      categories.push(record);
      return categoryRow(record);
    },
    async deleteCategory(id) {
      const c = categories.find((x) => x.id === id);
      if (!c) return;
      if (c.builtin) throw new Error("Built-in categories can't be deleted");
      categories = categories.filter((x) => x.id !== id);
      for (const q of questions) q.categoryIds = q.categoryIds.filter((cid) => cid !== id);
    },
    async setQuestionCategories(ids, add, remove) {
      for (const id of ids) {
        const q = findQuestion(id);
        q.categoryIds = [...new Set([...q.categoryIds.filter((c) => !remove.includes(c)), ...add])];
      }
    },

    // --- Study plans ----------------------------------------------------------

    async listPlans() {
      await sleep(60);
      return [...plans]
        .sort(
          (a, b) => Number(b.builtin) - Number(a.builtin) || b.updatedAt.localeCompare(a.updatedAt),
        )
        .map(planSummary);
    },
    async getPlan(id) {
      await sleep(60);
      const p = findPlan(id);
      return {
        ...planSummary(p),
        items: p.problemIds
          .map((pid) => questions.find((q) => q.id === pid))
          .filter((q): q is QuestionRecord => !!q)
          .map(summary),
      };
    },
    async savePlan(form) {
      await sleep(150);
      if (form.id) {
        const p = editablePlan(form.id);
        Object.assign(p, { name: form.name.trim(), description: form.description.trim() });
        touchPlan(p);
        return planSummary(p);
      }
      const record: PlanRecord = {
        id: newId("plan"),
        name: form.name.trim(),
        description: form.description.trim(),
        builtin: false,
        problemIds: [],
        updatedAt: now(),
      };
      plans.push(record);
      return planSummary(record);
    },
    async duplicatePlan(id) {
      const p = findPlan(id);
      const copy: PlanRecord = {
        ...structuredClone(p),
        id: newId("plan"),
        name: `${p.name} (copy)`,
        builtin: false,
        updatedAt: now(),
      };
      plans.push(copy);
      return planSummary(copy);
    },
    async deletePlan(id) {
      editablePlan(id);
      plans = plans.filter((p) => p.id !== id);
    },
    async setPlanItems(id, problemIds) {
      const p = editablePlan(id);
      p.problemIds = [...new Set(problemIds)];
      touchPlan(p);
    },
  };
}
