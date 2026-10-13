import { LockIcon, PencilLineIcon, SparklesIcon, FileInputIcon } from "lucide-react";
import type { ProblemOrigin } from "@/schemas";

export const ORIGIN_LABEL: Record<ProblemOrigin, string> = {
  builtin: "Built-in",
  manual: "Mine",
  ai_imported: "Imported",
  ai_generated: "AI-generated",
};

const ICONS = {
  builtin: LockIcon,
  manual: PencilLineIcon,
  ai_imported: FileInputIcon,
  ai_generated: SparklesIcon,
};

export function OriginBadge({ origin }: { origin: ProblemOrigin }) {
  const Icon = ICONS[origin];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {ORIGIN_LABEL[origin]}
    </span>
  );
}
