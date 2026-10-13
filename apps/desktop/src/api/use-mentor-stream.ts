import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { api } from "./client";
import { queryKeys } from "./keys";
import type { MentorRequest } from "./types";

/** Streams a mentor reply. The finished message lands in the chat query cache. */
export function useMentorStream(problemId: string) {
  const qc = useQueryClient();
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (req: Omit<MentorRequest, "problemId">) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setError(null);
      setPending({ question: req.message, answer: "" });
      try {
        await api.sendMentorMessage(
          { ...req, problemId },
          (event) => {
            if (event.type === "delta") {
              setPending((p) => (p ? { ...p, answer: p.answer + event.text } : p));
            } else if (event.type === "reset") {
              setPending((p) => (p ? { ...p, answer: "" } : p));
            } else if (event.type === "error") {
              setError(event.message);
            }
          },
          controller.signal,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        await qc.invalidateQueries({ queryKey: queryKeys.chat(problemId) });
        setPending(null);
        setStreaming(false);
      }
    },
    [problemId, qc],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { send, cancel, streaming, pending, error };
}
