import { createMockApi } from "./mock";
import type { CodegymApi } from "./types";

// Milestone 0 runs entirely on the mock backend (browser prototype). Milestone 1 adds the Tauri
// implementation and picks it when running inside the desktop shell.
export const api: CodegymApi = createMockApi();
