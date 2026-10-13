import { describe, expect, it } from "vite-plus/test";
import { aiProfileFormSchema, emptyProfileForm } from "./ai";
import { customInputFormSchema } from "./custom-input";
import {
  editorFormFromSettings,
  editorSettingsFormSchema,
  settingsFromEditorForm,
  type AppSettings,
} from "./settings";

const settings: AppSettings = {
  theme: "dark",
  defaultLanguage: "python",
  editorFontSize: 14,
  editorTabSize: 4,
  autosaveSeconds: 5,
  runTimeoutSeconds: 10,
};

describe("editor settings form", () => {
  it("defaults auto-save to the 5 second preset and round-trips", () => {
    const form = editorFormFromSettings(settings);
    expect(form.autosavePreset).toBe("5");
    expect(settingsFromEditorForm(editorSettingsFormSchema.parse(form))).toEqual(settings);
  });

  it("maps 0 seconds to Off", () => {
    const form = editorFormFromSettings({ ...settings, autosaveSeconds: 0 });
    expect(form.autosavePreset).toBe("off");
    expect(settingsFromEditorForm(form).autosaveSeconds).toBe(0);
  });

  it("maps a non-preset interval to custom", () => {
    const form = editorFormFromSettings({ ...settings, autosaveSeconds: 45 });
    expect(form).toMatchObject({ autosavePreset: "custom", autosaveCustom: "45" });
    expect(settingsFromEditorForm(form).autosaveSeconds).toBe(45);
  });

  it.each(["0", "301", "abc", "", "2.5"])("rejects custom interval %j", (value) => {
    const form = { ...editorFormFromSettings(settings), autosavePreset: "custom" as const, autosaveCustom: value };
    const result = editorSettingsFormSchema.safeParse(form);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["autosaveCustom"]);
  });

  it.each(["1", "300"])("accepts custom interval %s", (value) => {
    const form = { ...editorFormFromSettings(settings), autosavePreset: "custom" as const, autosaveCustom: value };
    expect(editorSettingsFormSchema.safeParse(form).success).toBe(true);
  });

  it("ignores the custom field when a preset is chosen", () => {
    const form = { ...editorFormFromSettings(settings), autosaveCustom: "nonsense" };
    expect(editorSettingsFormSchema.safeParse(form).success).toBe(true);
  });
});

describe("AI profile form", () => {
  it("does not require a key for Ollama", () => {
    expect(aiProfileFormSchema.safeParse(emptyProfileForm("ollama")).success).toBe(true);
  });

  it("requires a key for OpenCode Zen unless one is stored", () => {
    const form = { ...emptyProfileForm("opencode_zen"), model: "big-pickle" };
    const missing = aiProfileFormSchema.safeParse(form);
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["apiKey"]);
    expect(aiProfileFormSchema.safeParse({ ...form, hasStoredKey: true }).success).toBe(true);
    expect(aiProfileFormSchema.safeParse({ ...form, apiKey: "zen-123" }).success).toBe(true);
  });

  it("checks the Anthropic key prefix", () => {
    const form = emptyProfileForm("anthropic");
    expect(aiProfileFormSchema.safeParse({ ...form, apiKey: "nope" }).success).toBe(false);
    expect(aiProfileFormSchema.safeParse({ ...form, apiKey: "sk-ant-abc" }).success).toBe(true);
  });

  it("requires a valid http(s) URL and a model for custom endpoints", () => {
    const form = emptyProfileForm("custom");
    const result = aiProfileFormSchema.safeParse(form);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["baseUrl", "model"]));
    expect(
      aiProfileFormSchema.safeParse({ ...form, baseUrl: "ftp://x", model: "m" }).success,
    ).toBe(false);
    expect(
      aiProfileFormSchema.safeParse({ ...form, baseUrl: "http://localhost:1234/v1", model: "m" })
        .success,
    ).toBe(true);
  });
});

describe("custom test input", () => {
  const schema = customInputFormSchema({
    functionName: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[]",
  });

  it("accepts JSON matching the parameter types", () => {
    expect(schema.safeParse({ nums: "[1, 2, 3]", target: "4" }).success).toBe(true);
  });

  it("rejects invalid JSON and wrong types with a message per field", () => {
    const result = schema.safeParse({ nums: "[1, 2,", target: "1.5" });
    expect(result.success).toBe(false);
    const byField = Object.fromEntries(result.error!.issues.map((i) => [i.path[0], i.message]));
    expect(byField.nums).toBe("Not valid JSON");
    expect(byField.target).toMatch(/Expected int/);
  });
});
