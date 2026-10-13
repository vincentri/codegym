import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2Icon, CircleDotIcon, FlameIcon, SearchIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useProblems, useStats } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

function StatsBar() {
  const { data: stats } = useStats();
  if (!stats) return <Skeleton className="h-24 w-full" />;
  const pct = stats.total ? Math.round((stats.solved / stats.total) * 100) : 0;
  const rows: { key: Difficulty; label: string; color: string }[] = [
    { key: "easy", label: "Easy", color: "[&>[data-slot=progress-indicator]]:bg-easy" },
    { key: "medium", label: "Medium", color: "[&>[data-slot=progress-indicator]]:bg-medium" },
    { key: "hard", label: "Hard", color: "[&>[data-slot=progress-indicator]]:bg-hard" },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr_180px]">
      <Card className="py-4">
        <CardContent className="flex items-center gap-4 px-4">
          <div
            className="relative flex size-16 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--muted) 0deg)`,
            }}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-card text-sm font-semibold">
              {pct}%
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {stats.solved}
              <span className="text-base text-muted-foreground">/{stats.total}</span>
            </div>
            <div className="text-xs text-muted-foreground">problems solved</div>
          </div>
        </CardContent>
      </Card>
      <Card className="py-4">
        <CardContent className="grid gap-2.5 px-4">
          {rows.map((r) => {
            const d = stats.byDifficulty[r.key];
            return (
              <div
                key={r.key}
                className="grid grid-cols-[64px_1fr_56px] items-center gap-3 text-sm"
              >
                <DifficultyBadge difficulty={r.key} className="text-sm" />
                <Progress
                  value={d.total ? (d.solved / d.total) * 100 : 0}
                  className={`h-2 ${r.color}`}
                />
                <span className="text-right tabular-nums text-muted-foreground">
                  {d.solved}/{d.total}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card className="py-4">
        <CardContent className="flex items-center gap-3 px-4">
          <FlameIcon className="size-8 text-medium" />
          <div>
            <div className="text-2xl font-semibold">{stats.streakDays} days</div>
            <div className="text-xs text-muted-foreground">current streak</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProblemsPage() {
  const { data: problems, isLoading } = useProblems();
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
        <StatsBar />

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
          <ImportProblemDialog />
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
                    No problems match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
