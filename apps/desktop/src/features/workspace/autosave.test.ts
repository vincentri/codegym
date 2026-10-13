import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Autosaver, type AutosaveState } from "./autosave";

describe("Autosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(interval: number) {
    const save = vi.fn((_code: string) => Promise.resolve());
    const states: AutosaveState[] = [];
    const saver = new Autosaver("start", save, (s) => states.push(s));
    saver.start(interval);
    return { save, saver, states };
  }

  it("saves on the interval only when the code changed", async () => {
    const { save, saver } = setup(5);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();

    saver.setCode("changed");
    await vi.advanceTimersByTimeAsync(4999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledWith("changed");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("respects the configured interval", async () => {
    const { save, saver } = setup(30);
    saver.setCode("x");
    await vi.advanceTimersByTimeAsync(29_000);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("interval 0 disables the timer but flush still saves", async () => {
    const { save, saver } = setup(0);
    saver.setCode("x");
    await vi.advanceTimersByTimeAsync(600_000);
    expect(save).not.toHaveBeenCalled();
    await saver.flush();
    expect(save).toHaveBeenCalledWith("x");
  });

  it("flush is a no-op when nothing changed", async () => {
    const { save, saver } = setup(5);
    await saver.flush();
    saver.setCode("start");
    await saver.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("reports dirty, saving and saved states", async () => {
    const { saver, states } = setup(5);
    saver.setCode("x");
    expect(states.at(-1)?.dirty).toBe(true);
    await saver.flush();
    const last = states.at(-1)!;
    expect(last.dirty).toBe(false);
    expect(last.saving).toBe(false);
    expect(last.savedAt).toBeInstanceOf(Date);
    expect(states.some((s) => s.saving)).toBe(true);
  });

  it("keeps the change dirty and reports the error when saving fails", async () => {
    const save = vi.fn(() => Promise.reject(new Error("disk full")));
    const states: AutosaveState[] = [];
    const saver = new Autosaver("a", save, (s) => states.push(s));
    saver.setCode("b");
    await saver.flush();
    expect(states.at(-1)).toMatchObject({ dirty: true, saving: false, error: "disk full" });
  });

  it("stop() cancels the timer", async () => {
    const { save, saver } = setup(5);
    saver.setCode("x");
    saver.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(save).not.toHaveBeenCalled();
  });
});
