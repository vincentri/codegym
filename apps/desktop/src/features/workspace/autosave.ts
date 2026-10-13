export type SaveFn = (code: string) => Promise<unknown>;

export interface AutosaveState {
  dirty: boolean;
  saving: boolean;
  savedAt: Date | null;
  error: string | null;
}

/**
 * Saves the editor contents on a fixed interval, but only when they changed since the last
 * save. `flush()` saves immediately (used on Run/Submit, blur, language or problem switch).
 * An interval of 0 disables the timer; `flush()` still works.
 */
export class Autosaver {
  private lastSaved: string;
  private current: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  private state: AutosaveState;

  constructor(
    initialCode: string,
    private save: SaveFn,
    private readonly onState: (s: AutosaveState) => void,
    savedAt: Date | null = null,
  ) {
    this.lastSaved = initialCode;
    this.current = initialCode;
    this.state = { dirty: false, saving: false, savedAt, error: null };
  }

  /** Swaps the save function (e.g. when the owning component re-renders with a new callback). */
  setSaveFn(save: SaveFn) {
    this.save = save;
  }

  setCode(code: string) {
    this.current = code;
    this.update({ dirty: code !== this.lastSaved });
  }

  /** (Re)starts the timer. Call again whenever the interval setting changes. */
  start(intervalSeconds: number) {
    this.stop();
    if (intervalSeconds > 0) {
      this.timer = setInterval(() => void this.flush(), intervalSeconds * 1000);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<void> {
    if (this.inFlight) await this.inFlight;
    const code = this.current;
    if (code === this.lastSaved) return;
    this.update({ saving: true });
    this.inFlight = this.save(code)
      .then(() => {
        this.lastSaved = code;
        this.update({
          saving: false,
          dirty: this.current !== code,
          savedAt: new Date(),
          error: null,
        });
      })
      .catch((e: unknown) => {
        this.update({ saving: false, error: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => {
        this.inFlight = null;
      });
    await this.inFlight;
  }

  private update(patch: Partial<AutosaveState>) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }
}
