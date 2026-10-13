import { isTauri } from "@tauri-apps/api/core";
import { createMockApi } from "./mock";
import { createTauriApi } from "./tauri";
import type { CodegymApi } from "./types";

// Inside the desktop app every call goes to the Rust backend. In a plain browser (the published
// prototype, `vp dev` without Tauri) and in tests the mock backend stands in.
export const api: CodegymApi = isTauri() ? createTauriApi() : createMockApi();
