import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2Icon, CircleDotIcon, FilePenLineIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { usePlan, usePlans, useProblems } from "@/api/hooks";
import { CategoryBadges } from "@/components/common/CategoryBadge";
import { CategoryPicker } from "@/components/common/CategoryPicker";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
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

type StatusFilter = "all" | ProblemSummary["status"];

export function StatusIcon({ status }: { status: ProblemSummary["status"] }) {
  if (status === "solved")
    return <CheckCircle2Icon className="size-4 text-primary" aria-label="Solved" />;
  if (status === "attempted")
    return <CircleDotIcon className="size-4 text-medium" aria-label="Attempted" />;
  return <span className="block size-4" />;
}

export function ProblemsPage() {
  const search = useSearch({ from: "/app/problems" });
  const navigate = useNavigate({ from: "/problems" });
  const { data: problems, isLoading } = useProblems();
  const { data: plans } = usePlans();
  const plan = usePlan(search.plan ?? "");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const categoryParam = search.category ?? "";
  const categoryIds = useMemo(
    () => (categoryParam ? categoryParam.split(",") : []),
    [categoryParam],
  );
  const source = search.source ?? "all";

  const planIds = useMemo(
    () => (search.plan && plan.data ? new Set(plan.data.items.map((p) => p.id)) : null),
    [search.plan, plan.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (problems ?? []).filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || String(p.number) === q) &&
        (difficulty === "all" || p.difficulty === difficulty) &&
        (status === "all" || p.status === status) &&
        (source === "all" || (source === "builtin") === (p.origin === "builtin")) &&
        (categoryIds.length === 0 || p.categories.some((c) => categoryIds.includes(c.id))) &&
        (!planIds || planIds.has(p.id)),
    );
  }, [problems, query, difficulty, status, source, categoryIds, planIds]);

  const solved = filtered.filter((p) => p.status === "solved").length;
  const hasUrlFilters = !!(search.category || search.plan || search.source);

  return (
    <>
      <PageHeader
        title="Problems"
        description={problems ? `${solved} of ${filtered.length} solved` : undefined}
        actions={
          <Button variant="outline" asChild>
            <Link to="/bank/questions">
              <FilePenLineIcon /> Manage questions
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search problems"
              placeholder="Search by title or number…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="w-56">
            <CategoryPicker
              value={categoryIds}
              placeholder="All categories"
              onChange={(ids) =>
                void navigate({
                  search: (s) => ({ ...s, category: ids.length ? ids.join(",") : undefined }),
                })
              }
            />
          </div>
          <Select
            value={search.plan ?? "all"}
            onValueChange={(v) =>
              void navigate({ search: (s) => ({ ...s, plan: v === "all" ? undefined : v }) })
            }
          >
            <SelectTrigger className="w-48" aria-label="Study plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any study plan</SelectItem>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  source: v === "all" ? undefined : (v as "builtin" | "mine"),
                }),
              })
            }
          >
            <SelectTrigger className="w-36" aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="builtin">Built-in</SelectItem>
              <SelectItem value="mine">Mine</SelectItem>
            </SelectContent>
          </Select>
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
          {hasUrlFilters && (
            <Button variant="ghost" size="sm" onClick={() => void navigate({ search: {} })}>
              <XIcon /> Clear filters
            </Button>
          )}
        </div>

        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead>Categories</TableHead>
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
                    <StatusIcon status={p.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{p.number}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </TableCell>
                  <TableCell>
                    <CategoryBadges categories={p.categories} />
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
      </PageBody>
    </>
  );
}
