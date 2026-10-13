import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MentorStreamEvent } from "@/schemas";
import fixture from "./backend-contract.json";
import { BackendError } from "./backend";
import { createHttpApi } from "./http";
import type { MentorRequest } from "./types";

function reply(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A streaming reply whose bytes arrive in the given pieces (split mid-line on purpose). */
function chunked(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

const mentorRequest: MentorRequest = {
  problemId: "two-sum",
  language: "javascript",
  mode: "hint",
  message: "Help",
  code: "",
  lastRun: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http api", () => {
  it("posts the command's arguments as JSON and checks the reply", async () => {
    const fetchMock = vi.fn(async () => reply(200, fixture.getStats));
    vi.stubGlobal("fetch", fetchMock);
    const stats = await createHttpApi().getStats();
    expect(stats.total).toBe(fixture.getStats.total);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("api/get_stats");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");

    fetchMock.mockImplementationOnce(async () => reply(200, fixture.getProblem));
    await createHttpApi().getProblem("two-sum");
    const [, second] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(second.body as string)).toEqual({ id: "two-sum" });
  });

  it("turns error replies into BackendError", async () => {
    vi.stubGlobal("fetch", async () =>
      reply(404, { kind: "not_found", message: "nope not found" }),
    );
    const error = await createHttpApi()
      .getProblem("nope")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({ kind: "not_found", message: "nope not found" });

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(createHttpApi().getStats()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("streams mentor events split across chunks, then resolves", async () => {
    const lines = fixture.mentorEvents.map((event) => JSON.stringify({ event })).join("\n");
    const text = `${lines}\n${JSON.stringify({ result: null })}\n`;
    const third = Math.floor(text.length / 3);
    vi.stubGlobal("fetch", async () =>
      chunked([text.slice(0, third), text.slice(third, 2 * third), text.slice(2 * third)]),
    );
    const events: MentorStreamEvent[] = [];
    await createHttpApi().sendMentorMessage(
      mentorRequest,
      (e) => events.push(e),
      new AbortController().signal,
    );
    expect(events.map((e) => e.type)).toEqual(["delta", "delta", "done"]);
  });

  it("rejects when a stream ends with an error or stops early", async () => {
    vi.stubGlobal("fetch", async () =>
      chunked([`${JSON.stringify({ error: { kind: "invalid", message: "No AI profile" } })}\n`]),
    );
    await expect(
      createHttpApi().sendMentorMessage(mentorRequest, () => {}, new AbortController().signal),
    ).rejects.toMatchObject({ kind: "invalid", message: "No AI profile" });

    vi.stubGlobal("fetch", async () => chunked([`${JSON.stringify({ event: {} })}\n`]));
    await expect(
      createHttpApi().generateQuestions(
        { topic: "Array", difficulty: "easy", count: 1, notes: "", planId: null },
        () => {},
      ),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it("cancels a mentor reply on the server when aborted", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "api/cancel_ai"
        ? reply(200, null)
        : chunked([`${JSON.stringify({ result: null })}\n`]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const pending = createHttpApi().sendMentorMessage(mentorRequest, () => {}, controller.signal);
    controller.abort();
    await pending;
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("api/cancel_ai");
  });
});
