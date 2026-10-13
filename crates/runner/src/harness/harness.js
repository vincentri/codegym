
;(function () {
  "use strict";
  // Appended after the solver's code, so their line numbers match the editor.
  // `__CODEGYM_FN__` is replaced with a lookup of the function named in the signature.
  const fn = __CODEGYM_FN__;
  const io =
    typeof __codegym_emit === "function"
      ? { input: __codegym_input, emit: __codegym_emit }
      : {
          input: require("fs").readFileSync(0, "utf8"),
          emit: (line) => require("fs").writeSync(1, line + "\n"),
        };
  const spec = JSON.parse(io.input);
  const mark = "@@CODEGYM:" + spec.nonce + "@@";
  const send = (record) => io.emit(mark + JSON.stringify(record));
  const now =
    typeof performance !== "undefined" && performance.now
      ? () => performance.now()
      : () => Date.now();
  const OUT_LIMIT = 65536;

  const userFrame = (line) => {
    const m = /solution\.js:(\d+)/.exec(line);
    return m !== null && Number(m[1]) <= spec.userLines;
  };
  const errorText = (e) => {
    if (!(e instanceof Error)) return "Uncaught " + String(e);
    const head = e.name + ": " + e.message;
    const frames = String(e.stack || "")
      .split("\n")
      .filter((l) => /^\s+at /.test(l) && userFrame(l));
    return [head, ...frames].join("\n");
  };

  if (typeof fn !== "function") {
    send({
      loadError:
        "Function `" +
        spec.fn +
        "` is not defined. Keep the function name from the starter code.",
    });
    return;
  }

  class LN {
    constructor(val, next) {
      this.val = val === undefined ? 0 : val;
      this.next = next === undefined ? null : next;
    }
  }
  class TN {
    constructor(val, left, right) {
      this.val = val === undefined ? 0 : val;
      this.left = left === undefined ? null : left;
      this.right = right === undefined ? null : right;
    }
  }
  if (typeof globalThis.ListNode === "undefined") globalThis.ListNode = LN;
  if (typeof globalThis.TreeNode === "undefined") globalThis.TreeNode = TN;

  const toList = (a) => {
    let head = null;
    for (let i = a.length - 1; i >= 0; i--) head = new LN(a[i], head);
    return head;
  };
  const fromList = (head) => {
    const out = [];
    for (let n = head; n; n = n.next) {
      if (out.length >= 100000) throw new Error("The returned list has a cycle or is too long");
      out.push(n.val);
    }
    return out;
  };
  const toTree = (a) => {
    if (a.length === 0 || a[0] === null) return null;
    const root = new TN(a[0]);
    const queue = [root];
    let head = 0;
    let i = 1;
    while (i < a.length && head < queue.length) {
      const node = queue[head++];
      if (i < a.length && a[i] !== null) queue.push((node.left = new TN(a[i])));
      i++;
      if (i < a.length && a[i] !== null) queue.push((node.right = new TN(a[i])));
      i++;
    }
    return root;
  };
  const fromTree = (root) => {
    const out = [];
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const n = queue[head];
      if (n) {
        if (queue.length > 400000) throw new Error("The returned tree has a cycle or is too large");
        out.push(n.val);
        queue.push(n.left || null, n.right || null);
      } else out.push(null);
    }
    while (out.length > 0 && out[out.length - 1] === null) out.pop();
    return out;
  };
  const decode = (type, v) => {
    if (type === "ListNode") return toList(v);
    if (type === "ListNode[]") return v.map(toList);
    if (type === "TreeNode") return toTree(v);
    return v;
  };
  const encode = (type, v) => {
    if (type === "void") return null;
    if (type === "ListNode") return fromList(v);
    if (type === "ListNode[]") return v.map(fromList);
    if (type === "TreeNode") return fromTree(v);
    return v === undefined ? null : v;
  };

  let logs = [];
  let logged = 0;
  const show = (a) => {
    if (typeof a === "string") return a;
    try {
      const s = JSON.stringify(a);
      return s === undefined ? String(a) : s;
    } catch {
      return String(a);
    }
  };
  const log = (...args) => {
    const line = args.map(show).join(" ") + "\n";
    if (logged < OUT_LIMIT) logs.push(line.slice(0, OUT_LIMIT - logged));
    logged += line.length;
  };
  if (typeof globalThis.console === "undefined") globalThis.console = {};
  for (const k of ["log", "info", "warn", "error", "debug", "trace"]) globalThis.console[k] = log;

  send({ ready: true });
  spec.tests.forEach((args, i) => {
    logs = [];
    logged = 0;
    let record;
    try {
      const decoded = args.map((v, j) => decode(spec.params[j], v));
      const start = now();
      const ret = fn(...decoded);
      const ms = now() - start;
      const value =
        spec.inPlace === null
          ? encode(spec.returns, ret)
          : encode(spec.params[spec.inPlace], decoded[spec.inPlace]);
      record = { i, ok: true, value, ms };
    } catch (e) {
      record = { i, ok: false, error: errorText(e), ms: 0 };
    }
    record.out = logs.join("") + (logged > OUT_LIMIT ? "… (output truncated)\n" : "");
    try {
      send(record);
    } catch (e) {
      send({ i, ok: false, error: "Your answer can't be converted to JSON: " + errorText(e), out: record.out, ms: record.ms });
    }
  });
  send({ done: true });
})();
