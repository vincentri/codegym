import { useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2Icon, CircleDotIcon, SearchIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useProblems } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Difficulty, ProblemSummary } from "@/schemas";
import { ImportProblemDialog } from "./ImportProblemDialog";

type StatusFilter = "all" | ProblemSummary["status"];

function StatusIcon({ status, custom }: { status: ProblemSummary["status"]; custom: boolean }) {
  if (status === "solved")
    return <CheckCircle2Icon className="size-4 text-primary" aria-label="Solved" />;
  if (status === "attempted")
    return <CircleDotIcon className="size-4 text-medium" aria-label="Attempted" />;
  if (custom)
    return <StarIcon className="size-4 text-muted-foreground" aria-label="Custom problem" />;
  return <span className="block size-4" />;
}

export function ProblemsPage() {
  const { source } = useSearch({ from: "/app/problems" });
  const mine = source === "custom";
  const { data: allProblems, isLoading } = useProblems();
  const problems = useMemo(
    () => allProblems?.filter((p) => !mine || p.source === "custom"),
    [allProblems, mine],
  );
  const solvedCount = problems?.filter((p) => p.status === "solved").length ?? 0;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const topics = useMemo(
    () =>
      [...new Set((problems ?? []).flatMap((p) => p.topics))].sort((a, b) => a.localeCompare(b)),
    [problems],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (problems ?? []).filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || String(p.number) === q) &&
        (difficulty === "all" || p.difficulty === difficulty) &&
        (topic === "all" || p.topics.includes(topic)) &&
        (status === "all" || p.status === status),
    );
  }, [problems, search, difficulty, topic, status]);

  return (
    <>
      <PageHeader
        title={mine ? "My problems" : "Problems"}
        description={
          problems
            ? `${solvedCount} of ${problems.length} solved${mine ? " · problems you imported" : ""}`
            : undefined
        }
        actions={<ImportProblemDialog />}
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search problems"
              placeholder="Search by title or number…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
            <SelectTrigger className="w-36" aria-label="Difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-44" aria-label="Topic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="todo">To do</SelectItem>
              <SelectItem value="attempted">Attempted</SelectItem>
              <SelectItem value="solved">Solved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead>Topics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() =>
                    void navigate({ to: "/problems/$problemId", params: { problemId: p.id } })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void navigate({ to: "/problems/$problemId", params: { problemId: p.id } });
                  }}
                >
                  <TableCell>
                    <StatusIcon status={p.status} custom={p.source === "custom"} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{p.number}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.topics.map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {mine && !allProblems?.some((p) => p.source === "custom")
                      ? "You haven't imported any problems yet. Use Import problem to add one."
                      : "No problems match these filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}
