import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2Icon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useCreateQuestion, useSetPlanItems } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import type { GeneratedQuestion } from "@/schemas";
import { useQuestionDraftStore } from "@/stores/question-draft";

/** Review list shared by "Generate with AI" and "Import text". */
export function GeneratedReview({
  items,
  planId,
  onDone,
}: {
  items: GeneratedQuestion[];
  planId: string | null;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(items.map((_, i) => i)));
  const create = useCreateQuestion();
  const setPlanItems = useSetPlanItems();
  const setDraft = useQuestionDraftStore((s) => s.setDraft);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const created = [];
      for (const i of selected) created.push(await create.mutateAsync(items[i]!.question));
      if (planId && created.length) {
        const plan = await api.getPlan(planId);
        await setPlanItems.mutateAsync({
          id: planId,
          problemIds: [...plan.items.map((p) => p.id), ...created.map((q) => q.id)],
        });
      }
      toast.success(`Saved ${created.length} ${created.length === 1 ? "question" : "questions"}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {items.map((item, i) => {
          const q = item.question;
          const total = item.verifiedTests + item.droppedTests;
          return (
            <li key={`${q.title}-${i}`} className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                className="mt-0.5"
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                aria-label={`Select ${q.title}`}
              />
              <div className="grid min-w-0 flex-1 gap-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{q.title}</span>
                  <DifficultyBadge difficulty={q.difficulty} />
                </div>
                <code className="truncate font-mono text-xs text-muted-foreground">
                  {q.signature.functionName}(
                  {q.signature.params.map((p) => `${p.name}: ${p.type}`).join(", ")}) →{" "}
                  {q.signature.returns}
                </code>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.droppedTests === 0 ? (
                    <CheckCircle2Icon className="size-3.5 text-primary" />
                  ) : (
                    <TriangleAlertIcon className="size-3.5 text-medium" />
                  )}
                  {item.verifiedTests}/{total} tests verified by running the reference solution
                  {item.droppedTests > 0 && ` · ${item.droppedTests} dropped`}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(q);
                  void navigate({ to: "/bank/questions/new", search: { draft: true } });
                }}
              >
                <PencilIcon /> Edit before saving
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving || selected.size === 0}>
          {saving && <Spinner />} Save selected ({selected.size})
        </Button>
      </div>
    </div>
  );
}
