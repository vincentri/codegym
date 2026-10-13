import type { Verdict } from "@/schemas";

export function formatValue(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value);
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
  time_limit: "Time Limit Exceeded",
  memory_limit: "Memory Limit Exceeded",
  internal_error: "Internal Error",
};

export function relativeTime(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
