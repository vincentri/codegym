import { isTauri } from "@tauri-apps/api/core";
import { createHttpApi } from "./http";
import { createMockApi } from "./mock";
import { createTauriApi } from "./tauri";
import type { CodegymApi } from "./types";

/** The browser build served from Docker by `codegym-server`. */
export const IN_DOCKER = import.meta.env.VITE_CODEGYM_BACKEND === "http";

/**
 * Where the UI's data comes from:
 * - the desktop app: the Rust backend through Tauri commands;
 * - the Docker build (`VITE_CODEGYM_BACKEND=http`): the same backend over HTTP;
 * - a plain browser (`vp dev`, the published prototype) and tests: the mock backend.
 */
function createApi(): CodegymApi {
  if (isTauri()) return createTauriApi();
  if (IN_DOCKER) return createHttpApi();
  return createMockApi();
}

export const api: CodegymApi = createApi();
