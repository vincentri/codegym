# CodeGym

A desktop app for practicing coding-interview problems offline, with an AI mentor that guides you
instead of handing you the answer. Bring your own AI: a free local model through Ollama, OpenCode
Zen, Claude, or any OpenAI-compatible endpoint.

> **Status:** milestone 0.1, a clickable UI prototype (dashboard layout with sidebar) running on sample data. The Rust backend
> (Tauri 2, SQLite, code runners for Python/JavaScript/Go, AI providers) lands in the next
> milestones.

## Stack

- **Frontend:** React 19, TypeScript, shadcn/ui (Tailwind CSS v4), TanStack Query and Router,
  Zod, React Hook Form, Monaco editor (bundled, works offline)
- **Tooling:** [Vite+](https://viteplus.dev) (`vp`): dev server, build, Oxlint, Oxfmt, Vitest; pnpm
- **Backend (next):** Tauri 2 + Rust, local SQLite, wasmtime (sandboxed Python), system Node.js and Go

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:1420
pnpm exec vp check  # format + lint + type check
pnpm exec vp test -C apps/desktop
```

## Conventions

- Every form is validated with a Zod schema through React Hook Form. Native browser validation is
  never used: forms set `noValidate` and inputs carry no `required`/`pattern`/`min`/`max`. Two
  project lint rules in `tools/oxlint-plugin` enforce this.
- Components talk to the backend only through the query/mutation hooks in
  `apps/desktop/src/api/hooks.ts`.
