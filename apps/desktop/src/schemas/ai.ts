import { z } from "zod";

export const providerKindSchema = z.enum(["ollama", "opencode_zen", "anthropic", "custom"]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

export const effortSchema = z.enum(["low", "medium", "high"]);
export const mentorStyleSchema = z.enum(["socratic", "direct"]);

/** In the Docker build the backend runs in a container, where the host's Ollama has its own name. */
// (Not `IN_DOCKER` from api/client: schemas stay free of the API layer.)
const OLLAMA_HOST =
  import.meta.env.VITE_CODEGYM_BACKEND === "http" ? "host.docker.internal" : "localhost";

export const PROVIDER_PRESETS: Record<
  ProviderKind,
  {
    label: string;
    baseUrl: string;
    keyRequired: boolean;
    description: string;
    defaultModel: string;
  }
> = {
  ollama: {
    label: "Ollama (local)",
    baseUrl: `http://${OLLAMA_HOST}:11434/v1`,
    keyRequired: false,
    description: "Free. Runs a model on your own computer. Install Ollama and pull a model first.",
    defaultModel: "qwen2.5-coder:7b",
  },
  opencode_zen: {
    label: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    keyRequired: true,
    description: "Hosted models, including free ones. Get a key at opencode.ai.",
    defaultModel: "",
  },
  anthropic: {
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    keyRequired: true,
    description: "Claude models through the Anthropic API. Pay per use with your own API key.",
    defaultModel: "claude-opus-5-5",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    keyRequired: false,
    description: "Any OpenAI-compatible endpoint: LM Studio, OpenRouter, Groq, OpenAI, …",
    defaultModel: "",
  },
};

/** Profile as returned by the backend. The API key itself never leaves Rust. */
export const aiProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: providerKindSchema,
  baseUrl: z.string(),
  model: z.string(),
  effort: effortSchema,
  mentorStyle: mentorStyleSchema,
  hasApiKey: z.boolean(),
  isActive: z.boolean(),
});
export type AiProfile = z.infer<typeof aiProfileSchema>;

const httpUrl = z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" });

const profileBase = z.object({
  id: z.string().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Give this profile a name")
    .max(40, "Keep the name under 40 characters"),
  baseUrl: httpUrl,
  model: z.string().trim().min(1, "Choose or type a model"),
  /** Blank means "keep the stored key" when editing. */
  apiKey: z.string().trim(),
  hasStoredKey: z.boolean(),
  effort: effortSchema,
  mentorStyle: mentorStyleSchema,
});

/** Form schema for Settings → AI Mentor, discriminated on the provider. */
export const aiProfileFormSchema = z
  .discriminatedUnion("provider", [
    profileBase.extend({ provider: z.literal("ollama") }),
    profileBase.extend({ provider: z.literal("opencode_zen") }),
    profileBase.extend({
      provider: z.literal("anthropic"),
      apiKey: z
        .string()
        .trim()
        .refine((v) => v === "" || v.startsWith("sk-ant-"), "Anthropic keys start with sk-ant-"),
    }),
    profileBase.extend({ provider: z.literal("custom") }),
  ])
  .superRefine((value, ctx) => {
    if (PROVIDER_PRESETS[value.provider].keyRequired && !value.apiKey && !value.hasStoredKey) {
      ctx.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: `${PROVIDER_PRESETS[value.provider].label} needs an API key`,
      });
    }
  });
export type AiProfileForm = z.infer<typeof aiProfileFormSchema>;

export function emptyProfileForm(provider: ProviderKind): AiProfileForm {
  const preset = PROVIDER_PRESETS[provider];
  return {
    id: null,
    provider,
    name: preset.label,
    baseUrl: preset.baseUrl,
    model: preset.defaultModel,
    apiKey: "",
    hasStoredKey: false,
    effort: "medium",
    mentorStyle: "socratic",
  } as AiProfileForm;
}

export function profileFormFromProfile(p: AiProfile): AiProfileForm {
  return {
    id: p.id,
    provider: p.provider,
    name: p.name,
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: "",
    hasStoredKey: p.hasApiKey,
    effort: p.effort,
    mentorStyle: p.mentorStyle,
  } as AiProfileForm;
}

export const connectionTestSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nullable(),
  error: z.string().nullable(),
});
export type ConnectionTest = z.infer<typeof connectionTestSchema>;
