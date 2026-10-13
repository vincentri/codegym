import type {
  AiProfile,
  AiProfileForm,
  AppSettings,
  ChatMessage,
  Dashboard,
  Draft,
  Language,
  MentorMode,
  ParamType,
  Problem,
  ProblemSummary,
  RunRequest,
  RunResult,
  Signature,
  Submission,
  TestResult,
} from "@/schemas";
import { MOCK_SUMMARIES, mockProblem } from "./mock-data";
import type { CodegymApi, MentorRequest } from "./types";

// In-memory backend used by the browser prototype and by tests. Milestone 1 replaces it with
// Rust commands behind the same interface.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
let idCounter = 1;
const newId = () => `mock-${idCounter++}`;

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

export function mockStarterCode(sig: Signature, lang: Language): string {
  const names = sig.params.map((p) => p.name);
  if (lang === "python") {
    const args = sig.params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`).join(", ");
    return `class Solution:\n    def ${sig.functionName}(self, ${args}) -> ${PY_TYPES[sig.returns]}:\n        pass\n`;
  }
  if (lang === "javascript") {
    const doc = sig.params.map((p) => ` * @param {${p.type}} ${p.name}`).join("\n");
    return `/**\n${doc}\n * @return {${sig.returns}}\n */\nfunction ${sig.functionName}(${names.join(", ")}) {\n  \n}\n`;
  }
  const args = sig.params.map((p) => `${p.name} ${GO_TYPES[p.type]}`).join(", ");
  const ret = GO_TYPES[sig.returns];
  return `func ${sig.functionName}(${args})${ret ? ` ${ret}` : ""} {\n    \n}\n`;
}

const MENTOR_REPLIES: Record<MentorMode, string> = {
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
  let problems: ProblemSummary[] = MOCK_SUMMARIES.map((p) => ({ ...p }));
  let streakDays = 3;
  const drafts = new Map<string, Draft>();
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
  const submissions: Submission[] = [
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
  const chats = new Map<string, ChatMessage[]>();
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

  const getProblem = (id: string): Problem => {
    const summary = problems.find((p) => p.id === id);
    if (!summary) throw new Error(`Unknown problem: ${id}`);
    return mockProblem(summary);
  };

  const fakeRun = async (req: RunRequest, includeHidden: boolean): Promise<RunResult> => {
    await sleep(500);
    const problem = getProblem(req.problemId);
    const starter = mockStarterCode(problem.signature, req.language);
    const attempted = req.code.trim() !== starter.trim() && /return/.test(req.code);
    const results: TestResult[] = problem.examples.map((t, index) => ({
      index,
      hidden: false,
      custom: false,
      input: t.input,
      expected: t.expected,
      actual: attempted ? t.expected : null,
      passed: attempted,
      stdout: index === 0 && attempted ? "debug: checking pair\n" : "",
      error: null,
      timeMs: 1 + index,
    }));
    if (includeHidden) {
      for (let i = 0; i < problem.hiddenTestCount; i++) {
        results.push({
          index: results.length,
          hidden: true,
          custom: false,
          input: null,
          expected: null,
          actual: null,
          passed: attempted,
          stdout: "",
          error: null,
          timeMs: 2,
        });
      }
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

  return {
    async listProblems() {
      await sleep(80);
      return problems;
    },
    async getProblem(id) {
      await sleep(60);
      return getProblem(id);
    },
    async getStats() {
      const byDifficulty = {
        easy: { solved: 0, total: 0 },
        medium: { solved: 0, total: 0 },
        hard: { solved: 0, total: 0 },
      };
      for (const p of problems) {
        byDifficulty[p.difficulty].total++;
        if (p.status === "solved") byDifficulty[p.difficulty].solved++;
      }
      return {
        solved: problems.filter((p) => p.status === "solved").length,
        total: problems.length,
        byDifficulty,
        streakDays,
      };
    },
    async getDashboard() {
      await sleep(80);
      const title = (id: string) => problems.find((p) => p.id === id)?.title ?? id;
      const lastAttempt = submissions.find(
        (s) => problems.find((p) => p.id === s.problemId)?.status === "attempted",
      );
      const continueProblem = lastAttempt
        ? {
            problem: problems.find((p) => p.id === lastAttempt.problemId)!,
            attempts: submissions.filter((s) => s.problemId === lastAttempt.problemId).length,
            language: lastAttempt.language,
            lastActiveAt: lastAttempt.createdAt,
          }
        : null;

      const byTopic = new Map<string, ProblemSummary[]>();
      for (const p of problems.filter((p) => p.source === "builtin")) {
        for (const t of p.topics) byTopic.set(t, [...(byTopic.get(t) ?? []), p]);
      }
      let suggestion: Dashboard["suggestion"] = null;
      for (const [topic, list] of byTopic) {
        const unsolved = list.filter((p) => p.status !== "solved");
        if (list.length < 3 || unsolved.length === 0) continue;
        const solved = list.length - unsolved.length;
        if (!suggestion || solved / list.length < suggestion.solved / suggestion.total) {
          suggestion = { topic, solved, total: list.length, problems: unsolved.slice(0, 3) };
        }
      }
      return {
        continueProblem,
        recentSubmissions: submissions
          .slice(0, 6)
          .map((s) => ({ ...s, problemTitle: title(s.problemId) })),
        suggestion,
      };
    },
    async resetProgress({ includeCustomProblems }) {
      await sleep(300);
      submissions.length = 0;
      drafts.clear();
      chats.clear();
      streakDays = 0;
      problems = problems
        .filter((p) => !(includeCustomProblems && p.source === "custom"))
        .map((p) => ({ ...p, status: "todo" as const }));
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
      return mockStarterCode(getProblem(problemId).signature, language);
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
      const summary = problems.find((p) => p.id === req.problemId);
      if (summary) {
        summary.status =
          run.verdict === "accepted"
            ? "solved"
            : summary.status === "solved"
              ? "solved"
              : "attempted";
      }
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
        builtinProblems: problems.filter((p) => p.source === "builtin").length,
        customProblems: problems.filter((p) => p.source === "custom").length,
        bankVersion: "2026.10.0",
      };
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
      const firstLine = text.trim().split("\n")[0]?.slice(0, 60) || "Imported problem";
      return {
        ...mockProblem(MOCK_SUMMARIES[MOCK_SUMMARIES.length - 1]!),
        id: newId(),
        title: firstLine,
      };
    },
  };
}
