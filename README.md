# CodeGym

A desktop app for practicing coding-interview problems offline, with an AI mentor that guides you
instead of handing you the answer. Bring your own AI: a free local model through Ollama, OpenCode
Zen, Claude, or any OpenAI-compatible endpoint.

> **Status:** milestone 1. The desktop app runs on a real backend:
> - 34 built-in problems (each with reference solutions in all three languages);
> - Run and Submit in Python, JavaScript and Go;
> - progress, drafts, solve records, question bank, categories and study plans stored in SQLite.
>
> Still to come:
> - **Next milestone:** the AI mentor, plus AI question import and generation.
> - **After that:** installers.

## How it works

| Piece | Where | What it does |
|---|---|---|
| UI | `apps/desktop/src` | React screens. All backend calls go through `api/hooks.ts`. Inside the app they reach Rust (`api/tauri.ts`); in a browser they use a mock (`api/mock.ts`). |
| Desktop shell | `apps/desktop/src-tauri` | Tauri 2. Exposes one command per API method. |
| Service | `crates/service` | The operations behind every screen, built on the store and the runner. |
| Store | `crates/core` | SQLite database (`codegym.db` in the app data folder), shared types, the answer comparator, and the built-in question bank. |
| Runner | `crates/runner` | Runs solutions against tests. See the language table below. |
| Question bank | `problems/` | One JSON file per problem plus `solutions/<language>/`. It is embedded in the app and synced into SQLite on launch. |

How each language runs:

| Language | Engine | Needs installing? |
|---|---|---|
| Python | CPython compiled to WebAssembly, inside wasmtime: no file or network access, memory cap, time limit | No (built in) |
| JavaScript | Node.js when installed, otherwise QuickJS (built in) | No |
| Go | The Go toolchain on your computer | Yes ([go.dev/dl](https://go.dev/dl/)) |

## Develop

```bash
pnpm install
./scripts/build-python-wasi.sh   # once: builds the WebAssembly Python into src-tauri/resources/python
pnpm --filter desktop tauri dev  # desktop app
pnpm dev                         # browser preview on the mock backend, http://localhost:1420

pnpm exec vp check               # format + lint + type check
pnpm exec vp test -C apps/desktop
cargo clippy --workspace --all-targets
cargo test --workspace           # store, runner sandbox, every problem × language
```

- **Linux:** building the desktop app needs `libwebkit2gtk-4.1-dev`.
- **Python build:** `scripts/build-python-wasi.sh` needs `clang-18 lld-18 wasi-libc libclang-rt-18-dev-wasm32` (Ubuntu 24.04 package names).

### Adding a built-in problem

1. Add `problems/<id>.json` and a solution in each of `problems/solutions/{javascript,python,go}/`.
2. List the id in `problems/bank.json`.
3. Check it:
   ```bash
   CODEGYM_PROBLEMS=<id> cargo test -p codegym-runner --test bank
   ```
   This runs every reference solution against every test and checks the starter code too.

## Conventions

- Every form is validated with a Zod schema through React Hook Form. Native browser validation is
  never used: forms set `noValidate` and inputs carry no `required`/`pattern`/`min`/`max`. Two
  project lint rules in `tools/oxlint-plugin` enforce this.
- Components talk to the backend only through the query/mutation hooks in
  `apps/desktop/src/api/hooks.ts`.
- Rust types serialize to the same camelCase shapes as the Zod schemas.
  `apps/desktop/src/api/backend-contract.json` holds recorded backend responses that the frontend
  tests parse with those schemas. Regenerate it with `UPDATE_CONTRACT=1 cargo test -p codegym-service`.
