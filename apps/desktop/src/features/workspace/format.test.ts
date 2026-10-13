import { describe, expect, it } from "vite-plus/test";
import { relativeTime } from "./format";

describe("relativeTime", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it.each([
    [2_000, "just now"],
    [30_000, "30s ago"],
    [25 * 60_000, "25m ago"],
    [5 * 3_600_000, "5h ago"],
    [50 * 3_600_000, "2d ago"],
  ])("%i ms ago → %s", (ms, expected) => {
    expect(relativeTime(ago(ms), now)).toBe(expected);
  });
});
