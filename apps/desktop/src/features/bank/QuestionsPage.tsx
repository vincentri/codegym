import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useBankQuestions, useSetHidden } from "@/api/hooks";
import { CategoryBadges } from "@/components/common/CategoryBadge";
import { CategoryPicker } from "@/components/common/CategoryPicker";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { OriginBadge } from "@/components/common/OriginBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { BankQuestion, Difficulty } from "@/schemas";
import { GenerateQuestionsDialog } from "./GenerateQuestionsDialog";
import { ImportProblemDialog } from "./ImportProblemDialog";
import { AddToPlanDialog, DeleteQuestionsDialog, EditCategoriesDialog } from "./QuestionDialogs";

type SourceTab = "all" | "builtin" | "mine" | "ai_generated";

type DialogState =
  | { kind: "categories"; questions: BankQuestion[] }
  | { kind: "plan"; questions: BankQuestion[] }
  | { kind: "delete"; questions: BankQuestion[] }
  | null;

function matchesSource(q: BankQuestion, tab: SourceTab) {
  if (tab === "all") return true;
  if (tab === "builtin") return q.origin === "builtin";
  if (tab === "ai_generated") return q.origin === "ai_generated";
  return q.origin !== "builtin";
}

function RowActions({ q, onDialog }: { q: BankQuestion; onDialog: (d: DialogState) => void }) {
  const navigate = useNavigate();
  const setHidden = useSetHidden();
  const builtin = q.origin === "builtin";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for ${q.title}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() =>
            void navigate({ to: "/problems/$problemId", params: { problemId: q.id } })
          }
        >
          <PlayIcon /> Solve
        </DropdownMenuItem>
        {!builtin && (
          <DropdownMenuItem
            onSelect={() =>
              void navigate({
                to: "/bank/questions/$questionId/edit",
                params: { questionId: q.id },
              })
            }
          >
            <PencilIcon /> Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => void navigate({ to: "/bank/questions/new", search: { from: q.id } })}
        >
          <CopyIcon /> Duplicate{builtin ? " to edit" : ""}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDialog({ kind: "categories", questions: [q] })}>
          <TagsIcon /> Categories…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDialog({ kind: "plan", questions: [q] })}>
          <MapIcon /> Add to study plan…
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await setHidden.mutateAsync({ ids: [q.id], hidden: !q.hidden });
            toast.success(
              q.hidden ? "Question shown in Problems" : "Question hidden from Problems",
            );
          }}
        >
          {q.hidden ? <EyeIcon /> : <EyeOffIcon />} {q.hidden ? "Unhide" : "Hide from Problems"}
        </DropdownMenuItem>
        {!builtin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDialog({ kind: "delete", questions: [q] })}
            >
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuestionsPage() {
  const search = useSearch({ from: "/app/bank/questions" });
  const navigate = useNavigate({ from: "/bank/questions" });
  const { data: questions, isLoading } = useBankQuestions();
  const setHidden = useSetHidden();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const sourceTab: SourceTab = search.source ?? "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (questions ?? []).filter(
      (x) =>
        (!q || x.title.toLowerCase().includes(q)) &&
        matchesSource(x, sourceTab) &&
        (difficulty === "all" || x.difficulty === difficulty) &&
        (categoryIds.length === 0 || x.categories.some((c) => categoryIds.includes(c.id))) &&
        (showHidden || !x.hidden),
    );
  }, [questions, query, sourceTab, difficulty, categoryIds, showHidden]);

  const selectedRows = filtered.filter((q) => selected.has(q.id));
  const allSelected = filtered.length > 0 && selectedRows.length === filtered.length;
  const anyBuiltinSelected = selectedRows.some((q) => q.origin === "builtin");
  const mineCount = questions?.filter((q) => q.origin !== "builtin").length ?? 0;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Questions"
        description={
          questions
            ? `${questions.length} questions · ${mineCount} created by you`
            : "Add, edit and organize the questions you practice."
        }
        actions={
          <>
            <GenerateQuestionsDialog triggerVariant="outline" />
            <ImportProblemDialog />
            <Button asChild>
              <Link to="/bank/questions/new">
                <PlusIcon /> New question
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={sourceTab}
            onValueChange={(v) => {
              if (!v) return;
              void navigate({
                search: { source: v === "all" ? undefined : (v as Exclude<SourceTab, "all">) },
              });
              setSelected(new Set());
            }}
            aria-label="Source"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="builtin">Built-in</ToggleGroupItem>
            <ToggleGroupItem value="mine">Mine</ToggleGroupItem>
            <ToggleGroupItem value="ai_generated">AI-generated</ToggleGroupItem>
          </ToggleGroup>
          <div className="relative min-w-52 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search questions"
              placeholder="Search questions…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="w-52">
            <CategoryPicker
              value={categoryIds}
              onChange={setCategoryIds}
              placeholder="All categories"
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
          <div className="flex items-center gap-2 px-1">
            <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
            <Label htmlFor="show-hidden" className="text-sm font-normal">
              Show hidden
            </Label>
          </div>
        </div>

        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
            <span className="font-medium">{selectedRows.length} selected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog({ kind: "categories", questions: selectedRows })}
            >
              <TagsIcon /> Add to category
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog({ kind: "plan", questions: selectedRows })}
            >
              <MapIcon /> Add to study plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await setHidden.mutateAsync({ ids: selectedRows.map((q) => q.id), hidden: true });
                toast.success("Hidden from Problems");
                setSelected(new Set());
              }}
            >
              <EyeOffIcon /> Hide
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={anyBuiltinSelected}
              title={
                anyBuiltinSelected
                  ? "Built-in questions can't be deleted. Hide them instead."
                  : undefined
              }
              onClick={() => setDialog({ kind: "delete", questions: selectedRows })}
            >
              <Trash2Icon /> Delete
            </Button>
            {anyBuiltinSelected && (
              <span className="text-xs text-muted-foreground">
                Built-in questions can't be deleted.
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelected(new Set())}
            >
              <XIcon /> Clear
            </Button>
          </div>
        )}

        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected ? true : selectedRows.length > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) =>
                      setSelected(v === true ? new Set(filtered.map((q) => q.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead className="w-32">Source</TableHead>
                <TableHead className="w-20 text-right">Tests</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {filtered.map((q) => (
                <TableRow
                  key={q.id}
                  data-state={selected.has(q.id) ? "selected" : undefined}
                  className={cn(q.hidden && "opacity-60")}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${q.title}`}
                      checked={selected.has(q.id)}
                      onCheckedChange={() => toggle(q.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {q.origin === "builtin" ? (
                      q.title
                    ) : (
                      <Link
                        to="/bank/questions/$questionId/edit"
                        params={{ questionId: q.id }}
                        className="hover:underline"
                      >
                        {q.title}
                      </Link>
                    )}
                    {q.hidden && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <EyeOffIcon className="size-3" /> Hidden
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </TableCell>
                  <TableCell>
                    <CategoryBadges categories={q.categories} />
                  </TableCell>
                  <TableCell>
                    <OriginBadge origin={q.origin} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {q.testCount}
                      {q.verified && (
                        <CheckIcon
                          className="size-3.5 text-primary"
                          aria-label="Verified with a reference solution"
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RowActions q={q} onDialog={setDialog} />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {sourceTab === "mine" && mineCount === 0
                      ? "You haven't created any questions yet. Use New question, Import text or Generate with AI."
                      : "No questions match these filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </PageBody>

      {dialog?.kind === "categories" && (
        <EditCategoriesDialog questions={dialog.questions} onOpenChange={() => setDialog(null)} />
      )}
      {dialog?.kind === "plan" && (
        <AddToPlanDialog questions={dialog.questions} onOpenChange={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && (
        <DeleteQuestionsDialog
          questions={dialog.questions}
          onOpenChange={() => setDialog(null)}
          onDeleted={() => setSelected(new Set())}
        />
      )}
    </>
  );
}
