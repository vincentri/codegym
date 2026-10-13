import type { Comparator } from "@/schemas";

const canonical = (v: unknown) => JSON.stringify(v);

function sortedBy<T>(items: T[]): T[] {
  return [...items].sort((a, b) => canonical(a).localeCompare(canonical(b)));
}

/**
 * Compares an actual answer with the expected one. Mirrors the Rust comparator that grades
 * submissions in the desktop app.
 */
export function answersMatch(comparator: Comparator, actual: unknown, expected: unknown): boolean {
  switch (comparator) {
    case "exact":
      return canonical(actual) === canonical(expected);
    case "unordered":
      return (
        Array.isArray(actual) &&
        Array.isArray(expected) &&
        canonical(sortedBy(actual)) === canonical(sortedBy(expected))
      );
    case "unorderedNested": {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      const norm = (xs: unknown[]) => sortedBy(xs.map((x) => (Array.isArray(x) ? sortedBy(x) : x)));
      return canonical(norm(actual)) === canonical(norm(expected));
    }
    case "float":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        Math.abs(actual - expected) <= 1e-5
      );
  }
}
