import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useSubmissions } from "@/api/hooks";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { Markdown } from "@/components/common/Markdown";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { languageLabel, type Problem } from "@/schemas";
import { formatDuration, VERDICT_LABEL } from "./format";

function Submissions({ problemId }: { problemId: string }) {
  const { data } = useSubmissions(problemId);
  if (!data?.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No submissions yet. Press Submit when you're ready.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {data.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          {s.verdict === "accepted" ? (
            <CheckCircle2Icon className="size-4 text-primary" />
          ) : (
            <XCircleIcon className="size-4 text-destructive" />
          )}
          <div className="flex-1">
            <div
              className={
                s.verdict === "accepted"
                  ? "font-medium text-primary"
                  : "font-medium text-destructive"
              }
            >
              {VERDICT_LABEL[s.verdict]}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(s.createdAt).toLocaleString()} · {s.passed}/{s.total} tests
            </div>
          </div>
          <Badge variant="secondary">{languageLabel(s.language)}</Badge>
          {s.runtimeMs !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(s.runtimeMs)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DescriptionPanel({ problem }: { problem: Problem }) {
  return (
    <Tabs defaultValue="description" className="flex h-full flex-col gap-0">
      <div className="border-b px-2 py-1.5">
        <TabsList className="h-8">
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="description" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="p-4">
            <h1 className="text-lg font-semibold">
              {problem.number}. {problem.title}
            </h1>
            <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={problem.difficulty} />
              {problem.categories.map((c) => (
                <CategoryBadge key={c.id} category={c} />
              ))}
            </div>
            <Markdown>{problem.descriptionMd}</Markdown>
            {problem.constraints.length > 0 && (
              <>
                <h2 className="mt-5 mb-2 text-sm font-semibold">Constraints</h2>
                <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
                  {problem.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="submissions" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <Submissions problemId={problem.id} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
