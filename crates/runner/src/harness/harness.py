import io
import json
import linecache
import sys
import time
import traceback

PRELUDE = """
from typing import *
from collections import Counter, OrderedDict, defaultdict, deque
from functools import cache, lru_cache, reduce
from itertools import accumulate, combinations, permutations, product
import bisect, collections, functools, heapq, itertools, math, re, string


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
"""

OUT_LIMIT = 65536


def main():
    spec = json.loads(sys.stdin.read())
    real = sys.stdout
    mark = "@@CODEGYM:" + spec["nonce"] + "@@"

    def send(record):
        real.write(mark + json.dumps(record, allow_nan=False) + "\n")
        real.flush()

    def error_text(e):
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "solution.py"]
        lines = ["Traceback (most recent call last):\n"] if frames else []
        lines += traceback.format_list(frames)
        lines += traceback.format_exception_only(type(e), e)
        return "".join(lines).rstrip()

    src = spec["code"]
    linecache.cache["solution.py"] = (len(src), None, src.splitlines(True), "solution.py")
    ns = {"__name__": "solution"}
    exec(PRELUDE, ns)
    ListNode, TreeNode = ns["ListNode"], ns["TreeNode"]
    try:
        code = compile(src, "solution.py", "exec")
    except SyntaxError as e:
        send({"loadError": "".join(traceback.format_exception_only(type(e), e)).rstrip(), "syntax": True})
        return

    captured = io.StringIO()
    sys.stdout = captured
    try:
        exec(code, ns)
    except BaseException as e:
        sys.stdout = real
        send({"loadError": error_text(e), "out": captured.getvalue()[:OUT_LIMIT]})
        return
    sys.stdout = real

    name = spec["fn"]
    cls = ns.get("Solution")
    if isinstance(cls, type) and callable(getattr(cls, name, None)):
        make = lambda: getattr(cls(), name)
    elif callable(ns.get(name)):
        make = lambda: ns[name]
    else:
        send({"loadError": f"`Solution.{name}` is not defined. Keep the class and method names from the starter code."})
        return

    def to_list(a):
        head = None
        for v in reversed(a):
            head = ListNode(v, head)
        return head

    def from_list(head):
        out = []
        while head is not None:
            if len(out) >= 100000:
                raise ValueError("The returned list has a cycle or is too long")
            out.append(head.val)
            head = head.next
        return out

    def to_tree(a):
        if not a or a[0] is None:
            return None
        root = TreeNode(a[0])
        queue, head, i = [root], 0, 1
        while i < len(a) and head < len(queue):
            node = queue[head]
            head += 1
            if i < len(a) and a[i] is not None:
                node.left = TreeNode(a[i])
                queue.append(node.left)
            i += 1
            if i < len(a) and a[i] is not None:
                node.right = TreeNode(a[i])
                queue.append(node.right)
            i += 1
        return root

    def from_tree(root):
        out, queue, head = [], [root], 0
        while head < len(queue):
            node = queue[head]
            head += 1
            if node is None:
                out.append(None)
                continue
            if len(queue) > 400000:
                raise ValueError("The returned tree has a cycle or is too large")
            out.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
        while out and out[-1] is None:
            out.pop()
        return out

    def decode(t, v):
        if t == "ListNode":
            return to_list(v)
        if t == "ListNode[]":
            return [to_list(x) for x in v]
        if t == "TreeNode":
            return to_tree(v)
        return v

    def encode(t, v):
        if t == "void":
            return None
        if t == "ListNode":
            return from_list(v)
        if t == "ListNode[]":
            return [from_list(x) for x in v]
        if t == "TreeNode":
            return from_tree(v)
        if isinstance(v, tuple):
            return list(v)
        return v

    send({"ready": True})
    for i, args in enumerate(spec["tests"]):
        captured = io.StringIO()
        sys.stdout = captured
        try:
            decoded = [decode(t, v) for t, v in zip(spec["params"], args)]
            func = make()
            start = time.perf_counter()
            ret = func(*decoded)
            ms = (time.perf_counter() - start) * 1000
            k = spec["inPlace"]
            value = encode(spec["returns"], ret) if k is None else encode(spec["params"][k], decoded[k])
            record = {"i": i, "ok": True, "value": value, "ms": ms}
        except BaseException as e:
            record = {"i": i, "ok": False, "error": error_text(e), "ms": 0}
        finally:
            sys.stdout = real
        out = captured.getvalue()
        record["out"] = out[:OUT_LIMIT] + ("… (output truncated)\n" if len(out) > OUT_LIMIT else "")
        try:
            send(record)
        except (TypeError, ValueError) as e:
            send({"i": i, "ok": False, "error": f"Your answer can't be converted to JSON: {e}", "out": record["out"], "ms": record["ms"]})
    send({"done": True})


sys.setrecursionlimit(10000)
main()
