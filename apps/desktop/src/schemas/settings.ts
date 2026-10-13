import { z } from "zod";
import { languageSchema } from "./language";

export const themeSchema = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof themeSchema>;

/** Persisted app settings (stored in the SQLite `settings` table). */
export const appSettingsSchema = z.object({
  theme: themeSchema,
  defaultLanguage: languageSchema,
  editorFontSize: z.number().int().min(10).max(28),
  editorTabSize: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  /** Auto-save interval in seconds; 0 turns the timer off. */
  autosaveSeconds: z.number().int().min(0).max(300),
  runTimeoutSeconds: z.number().int().min(1).max(60),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const AUTOSAVE_PRESETS = ["off", "1", "2", "5", "10", "30", "60", "custom"] as const;

/** Form schema for Settings → Editor. Inputs are strings; the schema converts and range-checks. */
export const editorSettingsFormSchema = z
  .object({
    theme: themeSchema,
    defaultLanguage: languageSchema,
    editorFontSize: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter a whole number")
      .refine((v) => Number(v) >= 10 && Number(v) <= 28, "Font size must be between 10 and 28"),
    editorTabSize: z.enum(["2", "4", "8"]),
    autosavePreset: z.enum(AUTOSAVE_PRESETS),
    autosaveCustom: z.string().trim(),
    runTimeoutSeconds: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter a whole number")
      .refine((v) => Number(v) >= 1 && Number(v) <= 60, "Timeout must be between 1 and 60 seconds"),
  })
  .superRefine((value, ctx) => {
    if (value.autosavePreset !== "custom") return;
    if (!/^\d+$/.test(value.autosaveCustom)) {
      ctx.addIssue({
        code: "custom",
        path: ["autosaveCustom"],
        message: "Enter a whole number of seconds",
      });
      return;
    }
    const n = Number(value.autosaveCustom);
    if (n < 1 || n > 300) {
      ctx.addIssue({
        code: "custom",
        path: ["autosaveCustom"],
        message: "Interval must be between 1 and 300 seconds",
      });
    }
  });
export type EditorSettingsForm = z.infer<typeof editorSettingsFormSchema>;

export function editorFormFromSettings(s: AppSettings): EditorSettingsForm {
  const preset = s.autosaveSeconds === 0 ? "off" : String(s.autosaveSeconds);
  const isPreset = (AUTOSAVE_PRESETS as readonly string[]).includes(preset);
  return {
    theme: s.theme,
    defaultLanguage: s.defaultLanguage,
    editorFontSize: String(s.editorFontSize),
    editorTabSize: String(s.editorTabSize) as EditorSettingsForm["editorTabSize"],
    autosavePreset: (isPreset ? preset : "custom") as EditorSettingsForm["autosavePreset"],
    autosaveCustom: isPreset ? "" : String(s.autosaveSeconds),
    runTimeoutSeconds: String(s.runTimeoutSeconds),
  };
}

export function settingsFromEditorForm(f: EditorSettingsForm): AppSettings {
  const autosaveSeconds =
    f.autosavePreset === "off"
      ? 0
      : f.autosavePreset === "custom"
        ? Number(f.autosaveCustom)
        : Number(f.autosavePreset);
  return appSettingsSchema.parse({
    theme: f.theme,
    defaultLanguage: f.defaultLanguage,
    editorFontSize: Number(f.editorFontSize),
    editorTabSize: Number(f.editorTabSize),
    autosaveSeconds,
    runTimeoutSeconds: Number(f.runTimeoutSeconds),
  });
}

export const settingsTabSchema = z.enum(["ai", "editor", "languages", "data"]);
export type SettingsTab = z.infer<typeof settingsTabSchema>;
