import { describe, expect, it } from "vite-plus/test";
import { createMockApi } from "./mock";

describe("mock resetProgress", () => {
  it("clears progress, submissions and streak but keeps imported problems by default", async () => {
    const api = createMockApi();
    expect((await api.getStats()).solved).toBeGreaterThan(0);
    expect((await api.getDashboard()).recentSubmissions.length).toBeGreaterThan(0);

    await api.resetProgress({ includeCustomProblems: false });

    const stats = await api.getStats();
    expect(stats.solved).toBe(0);
    expect(stats.streakDays).toBe(0);
    const dashboard = await api.getDashboard();
    expect(dashboard.recentSubmissions).toEqual([]);
    expect(dashboard.continueProblem).toBeNull();
    const problems = await api.listProblems();
    expect(problems.every((p) => p.status === "todo")).toBe(true);
    expect(problems.some((p) => p.source === "custom")).toBe(true);
  });

  it("deletes imported problems when asked", async () => {
    const api = createMockApi();
    await api.resetProgress({ includeCustomProblems: true });
    expect((await api.listProblems()).some((p) => p.source === "custom")).toBe(false);
  });

  it("keeps settings and AI profiles", async () => {
    const api = createMockApi();
    const before = { settings: await api.getSettings(), profiles: await api.listAiProfiles() };
    await api.resetProgress({ includeCustomProblems: true });
    expect(await api.getSettings()).toEqual(before.settings);
    expect(await api.listAiProfiles()).toEqual(before.profiles);
  });
});
