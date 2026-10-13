import { z } from "zod";
import { packImportSchema } from "@/schemas";
import { createBackendApi } from "./backend";
import { downloadText, pickTextFile } from "./browser-file";
import type { CodegymApi } from "./types";

// The browser build served by `codegym-server` (Docker): every command is `POST /api/<command>`
// with the same JSON arguments as the desktop app's Tauri command (crates/server).

async function post(command: string, args?: Record<string, unknown>): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`api/${command}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args ?? null),
    });
  } catch {
    throw { kind: "unavailable", message: "Can't reach the CodeGym server. Is it still running?" };
  }
  if (!response.ok) {
    // Errors are `{ kind, message }`; anything else (a proxy's page) is passed on as text.
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = `${response.status} ${response.statusText}: ${text.slice(0, 200)}`;
    }
    throw body;
  }
  return response;
}

/** One line of a streaming reply: an event, then the result or an error. */
const streamLineSchema = z.union([
  z.object({ event: z.unknown() }),
  z.object({ result: z.unknown() }),
  z.object({ error: z.unknown() }),
]);

async function readStream(response: Response, onEvent: (raw: unknown) => void): Promise<unknown> {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!reader) throw "The server sent an empty reply.";
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += value ?? "";
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = streamLineSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      const message = parsed.data;
      if ("event" in message) onEvent(message.event);
      else if ("result" in message) return message.result;
      else throw message.error;
    }
    if (done) throw "The server closed the connection before finishing.";
  }
}

export function createHttpApi(): CodegymApi {
  return createBackendApi({
    invoke: async (command, args) => (await post(command, args)).json(),
    stream: async (command, args, _channelArg, onEvent) =>
      readStream(await post(command, args), onEvent),
    exportProblemPack: async (call) => {
      const pack = await call(
        "export_problem_pack_text",
        z.object({ text: z.string(), questions: z.number().int() }),
      );
      const name = "my-problems.codegym.json";
      downloadText(name, pack.text);
      return { path: name, questions: pack.questions };
    },
    importProblemPack: async (call) => {
      const text = await pickTextFile(".json,application/json");
      return text === null ? null : call("import_problem_pack_text", packImportSchema, { text });
    },
  });
}
