# CodeGym

A desktop app for practicing coding-interview problems offline, with an AI mentor that guides you
instead of handing you the answer. Bring your own AI: a free local model through Ollama, OpenCode
Zen, Claude, or any OpenAI-compatible endpoint.

> **Status:** milestone 3. The desktop app runs fully offline for practice and connects to the AI you choose for the mentor:
> - **Practice:** 34 built-in problems, each with reference solutions in every language. Run and Submit in Python, JavaScript, TypeScript, Go, Java, C++ and Rust.
> - **Saved in SQLite:** progress, drafts, solve records, the question bank, categories and study plans.
> - **AI mentor:** a streaming chat that sees your code and last run, but never hidden tests.
> - **AI questions:** import pasted problems or generate new ones. Every AI-written question is checked by running its reference solution in a sandbox.
> - **Problem packs:** export your own questions to a `.codegym.json` file and import someone else's (Settings → Data).
> - **API keys:** kept in the operating system's keychain.
> - **Releases:** every merge to `main` publishes a macOS `.dmg`.

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
| TypeScript | Types are stripped by the built-in oxc compiler (not type-checked), then it runs like JavaScript. Errors point at your TypeScript lines. | No |
| Go | The Go toolchain on your computer | Yes ([go.dev/dl](https://go.dev/dl/)) |
| Java | `javac` + `java` from a JDK 17+ on your computer | Yes (`brew install openjdk`, or [adoptium.net](https://adoptium.net/)) |
| C++ | `g++` or `clang++` (C++17) on your computer | macOS: `xcode-select --install` |
| Rust | `rustc` on your computer | Yes ([rustup.rs](https://rustup.rs/)) |

Code that runs on your toolchain (Go, Java, C++, Rust) is your own code, with a time limit. Code
written by the AI (reference solutions of generated questions) only ever runs in the built-in
sandboxes.

## Problem packs

**Settings → Data → Export my problems** saves every question you created or imported (not the
built-ins) to a `.codegym.json` file, with the custom categories they use. **Import problem pack**
adds a pack's questions to your bank:
- categories are matched by name and created when missing;
- questions whose title is already in your bank, or that don't pass validation, are skipped and
  listed;
- reference solutions are run again before a question is saved.

The format is `{ "format": "codegym-problem-pack", "version": 1, "exportedAt", "categories", "questions" }`,
where each question has the same shape as in the question editor.

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

**Without an admin account:** copy the app into your own `~/Applications` folder and clear the
quarantine flag there (no password needed):

```bash
mkdir -p ~/Applications
hdiutil attach ~/Downloads/CodeGym_<version>_universal.dmg -nobrowse -mountpoint /tmp/codegym-dmg
cp -R /tmp/codegym-dmg/CodeGym.app ~/Applications/
hdiutil detach /tmp/codegym-dmg
xattr -dr com.apple.quarantine ~/Applications/CodeGym.app
open ~/Applications/CodeGym.app
```

The app is signed ad hoc with the hardened runtime and `Entitlements.plist`, which lets the
built-in Python (WebAssembly compiled at run time) run.

## CI and releases

| Workflow | When | What |
|---|---|---|
| `ci.yml` | pull requests and pushes to other branches | UI format/lint/types/tests; on macOS, the runner tests signed like the app; Rust fmt, clippy (warnings are errors) and every test, including all built-in problems in all 7 languages (CI installs a JDK; g++ and rustc come with the runner) |
| `release.yml` | push to `main` | runs CI, builds the universal macOS app with the bundled WebAssembly Python, checks its signature and entitlements, then publishes the GitHub Release `v0.1.<run>` with the `.dmg` |
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

1. Add `problems/<id>.json` and a solution in each of
   `problems/solutions/{javascript,python,go,typescript,java,cpp,rust}/`.
2. List the id in `problems/bank.json`.
3. Check it:
   ```bash
   CODEGYM_PROBLEMS=<id> cargo test -p codegym-runner --test bank
   ```
   This runs every reference solution against every test and checks the starter code too.
   `CODEGYM_LANGUAGES=java,rust` limits it to some languages.

## Conventions

- Every form is validated with a Zod schema through React Hook Form. Native browser validation is
  never used: forms set `noValidate` and inputs carry no `required`/`pattern`/`min`/`max`. Two
  project lint rules in `tools/oxlint-plugin` enforce this.
- Components talk to the backend only through the query/mutation hooks in
  `apps/desktop/src/api/hooks.ts`.
- Rust types serialize to the same camelCase shapes as the Zod schemas.
  `apps/desktop/src/api/backend-contract.json` holds recorded backend responses that the frontend
  tests parse with those schemas. Regenerate it with `UPDATE_CONTRACT=1 cargo test -p codegym-service`.
