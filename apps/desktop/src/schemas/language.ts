import { z } from "zod";

export const languageSchema = z.enum(["javascript", "python", "go"]);
export type Language = z.infer<typeof languageSchema>;

export const LANGUAGES: { id: Language; label: string; monaco: string }[] = [
  { id: "python", label: "Python 3", monaco: "python" },
  { id: "javascript", label: "JavaScript (Node.js)", monaco: "javascript" },
  { id: "go", label: "Go", monaco: "go" },
];

export function languageLabel(lang: Language): string {
  return LANGUAGES.find((l) => l.id === lang)?.label ?? lang;
}

export const runtimeInfoSchema = z.object({
  language: languageSchema,
  engine: z.string(),
  version: z.string().nullable(),
  available: z.boolean(),
  bundled: z.boolean(),
  installHint: z.string().nullable(),
});
export type RuntimeInfo = z.infer<typeof runtimeInfoSchema>;
