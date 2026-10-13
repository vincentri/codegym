import { Channel, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { packExportSchema, packImportSchema } from "@/schemas";
import { createBackendApi } from "./backend";
import type { CodegymApi } from "./types";

const PACK_FILTERS = [{ name: "CodeGym problem pack", extensions: ["json"] }];

/** The desktop app: commands are Tauri commands, streams are Tauri channels. */
export function createTauriApi(): CodegymApi {
  return createBackendApi({
    invoke: (command, args) => invoke(command, args),
    stream: (command, args, channelArg, onEvent) => {
      const channel = new Channel<unknown>();
      channel.onmessage = onEvent;
      return invoke(command, { ...args, [channelArg]: channel });
    },
    exportProblemPack: async (call) => {
      const path = await save({ defaultPath: "my-problems.codegym.json", filters: PACK_FILTERS });
      return path ? call("export_problem_pack", packExportSchema, { path }) : null;
    },
    importProblemPack: async (call) => {
      const path = await open({ multiple: false, directory: false, filters: PACK_FILTERS });
      return typeof path === "string"
        ? call("import_problem_pack", packImportSchema, { path })
        : null;
    },
  });
}
