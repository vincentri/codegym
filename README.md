# CodeGym

A desktop app for practicing coding-interview problems offline, with an AI mentor that guides you
instead of handing you the answer. Bring your own AI: a free local model through Ollama, OpenCode
Zen, Claude, or any OpenAI-compatible endpoint.

> **Status:** milestone 2. The desktop app runs fully offline for practice and connects to the AI you choose for the mentor:
> - **Practice:** 34 built-in problems, each with reference solutions in all three languages. Run and Submit in Python, JavaScript and Go.
> - **Saved in SQLite:** progress, drafts, solve records, the question bank, categories and study plans.
> - **AI mentor:** a streaming chat that sees your code and last run, but never hidden tests.
> - **AI questions:** import pasted problems or generate new ones. Every AI-written question is checked by running its reference solution in a sandbox.
> - **API keys:** kept in the operating system's keychain.
>
> Next: installers and CI.

## How it works

| Piece | Where | What it does |
|---|---|---|
| UI | `apps/desktop/src` | React screens. All backend calls go through `api/hooks.ts`. Inside the app they reach Rust (`api/tauri.ts`); in a browser they use a mock (`api/mock.ts`). |
| Desktop shell | `apps/desktop/src-tauri` | Tauri 2. Exposes one command per API method. |
| Service | `crates/service` | The operations behind every screen, built on the store and the runner. |
| Store | `crates/core` | SQLite database (`codegym.db` in the app data folder), shared types, the answer comparator, and the built-in question bank. |
| Runner | `crates/runner` | Runs solutions against tests. See the language table below. |
| AI | `crates/ai` | Provider clients over raw HTTP (OpenAI-compatible for Ollama, OpenCode Zen and custom URLs; the Anthropic Messages API for Claude), streaming, keychain storage, prompts. |
| Question bank | `problems/` | One JSON file per problem plus `solutions/<language>/`. It is embedded in the app and synced into SQLite on launch. |

How each language runs:

| Language | Engine | Needs installing? |
|---|---|---|
| Python | CPython compiled to WebAssembly, inside wasmtime: no file or network access, memory cap, time limit | No (built in) |
| JavaScript | Node.js when installed, otherwise QuickJS (built in) | No |
| Go | The Go toolchain on your computer | Yes ([go.dev/dl](https://go.dev/dl/)) |

## AI providers

Pick one in **Settings → AI Mentor**:

| Provider | Base URL | Key |
|---|---|---|
| Ollama (free, local) | `http://localhost:11434/v1` | none |
| OpenCode Zen | `https://opencode.ai/zen/v1` | required |
| Claude | `https://api.anthropic.com` | required (`sk-ant-…`) |
| Custom | any OpenAI-compatible URL (LM Studio, OpenRouter, Groq, OpenAI, …) | optional |

**How the mentor works:**
- It guides with hints and questions. It writes a full solution only when you press **Show solution**.
- Each message includes the problem, your current code and your last run.
- Hidden tests stay hidden from the AI too.

**Using Claude:**
- Requests ask for server-side refusal fallback (`fallbacks: "default"`) on the models that support it.
- If the model declines, the reply says so instead of showing partial text.

**On Linux:** saving keys needs a Secret Service keyring, such as GNOME Keyring or KWallet. Ollama needs no key.

## Download and install (macOS)

Every merge to `main` publishes a release on the repository's **Releases** page.
- It contains one `.dmg` that runs on both Apple Silicon and Intel Macs.
- The version is `0.1.<build number>`.

To install:
1. Open the `.dmg` and drag **CodeGym** into **Applications**.
2. The app isn't notarized by Apple yet, so macOS blocks the first launch.
3. Open it once, then choose **System Settings → Privacy & Security → Open Anyway**.

   Or run `xattr -dr com.apple.quarantine /Applications/CodeGym.app` in Terminal.

## CI and releases

| Workflow | When | What |
|---|---|---|
| `ci.yml` | pull requests and pushes to other branches | UI format/lint/types/tests; Rust fmt, clippy (warnings are errors) and every test, including all built-in problems in JS, Python and Go |
| `release.yml` | push to `main` | runs CI, builds the universal macOS app with the bundled WebAssembly Python, creates the GitHub Release `v0.1.<run>` with the `.dmg` |
| `python-wasi.yml` | used by both | builds the WebAssembly Python once (cached by the build script's hash) and shares it as an artifact |

Apple signing and notarization can be added later by giving the release job the `APPLE_*` secrets that Tauri reads. That removes the "Open Anyway" step.

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
