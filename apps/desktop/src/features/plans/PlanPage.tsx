import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CopyIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeletePlan, useDuplicatePlan, usePlan, useSetPlanItems } from "@/api/hooks";
import { CategoryBadges } from "@/components/common/CategoryBadge";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIcon } from "@/features/problems/ProblemsPage";
import { PlanDialog, ProblemPickerDialog } from "./PlanDialogs";
import { PlanProgress } from "./PlansPage";

export function PlanPage() {
  const { planId } = useParams({ from: "/app/plans/$planId" });
  const { data: plan, isLoading, error } = usePlan(planId);
  const setItems = useSetPlanItems();
  const duplicate = useDuplicatePlan();
  const del = useDeletePlan();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Study plan not found" />
        <PageBody>
          <p className="text-sm text-muted-foreground">
            It may have been deleted.{" "}
            <Link to="/plans" className="text-primary hover:underline">
              Back to study plans
            </Link>
          </p>
        </PageBody>
      </>
    );
  }
  if (isLoading || !plan) {
    return (
      <PageBody>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </PageBody>
    );
  }

  const ids = plan.items.map((p) => p.id);
  const save = (next: string[]) =>
    setItems.mutateAsync({ id: plan.id, problemIds: next }).catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : String(e));
    });
  const move = (i: number, j: number) => {
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void save(next);
  };

  const duplicateAndOpen = async () => {
    const copy = await duplicate.mutateAsync(plan.id);
    toast.success("Plan duplicated. You can edit the copy.");
    void navigate({ to: "/plans/$planId", params: { planId: copy.id } });
  };

  return (
    <>
      <PageHeader
        title={plan.name}
        description={plan.description || undefined}
        actions={
          <>
            {plan.next && (
              <Button asChild>
                <Link to="/problems/$problemId" params={{ problemId: plan.next.id }}>
                  Start next <ArrowRightIcon />
                </Link>
              </Button>
            )}
            {!plan.builtin && (
              <Button variant="outline" onClick={() => setPicking(true)}>
                <PlusIcon /> Add problems
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Plan actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!plan.builtin && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <PencilIcon /> Rename or describe
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void duplicateAndOpen()}>
                  <CopyIcon /> Duplicate
                </DropdownMenuItem>
                {!plan.builtin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                      <Trash2Icon /> Delete plan
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <PageBody>
        <Card className="py-4">
          <CardContent className="grid gap-2 px-4">
            <PlanProgress plan={plan} />
            {plan.builtin && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockIcon className="size-3.5" /> Built-in plan. Duplicate it to add, remove or
                reorder problems.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <ol className="divide-y">
            {plan.items.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <StatusIcon status={p.status} />
                <Link
                  to="/problems/$problemId"
                  params={{ problemId: p.id }}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <div className="hidden md:block">
                  <CategoryBadges categories={p.categories.slice(0, 2)} />
                </div>
                <DifficultyBadge difficulty={p.difficulty} className="w-14" />
                {!plan.builtin && (
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Move ${p.title} up`}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Move ${p.title} down`}
                      disabled={i === plan.items.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${p.title} from plan`}
                      onClick={() => void save(ids.filter((id) => id !== p.id))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                )}
              </li>
            ))}
            {plan.items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                This plan is empty. Use Add problems to fill it.
              </li>
            )}
          </ol>
        </Card>
      </PageBody>

      {editing && (
        <PlanDialog
          initial={{ id: plan.id, name: plan.name, description: plan.description }}
          onOpenChange={setEditing}
        />
      )}
      {picking && (
        <ProblemPickerDialog
          exclude={ids}
          onOpenChange={setPicking}
          onAdd={async (added) => {
            await save([...ids, ...added]);
            toast.success(`Added ${added.length} to ${plan.name}`);
          }}
        />
      )}
      {deleting && (
        <AlertDialog open onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{plan.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Only the plan is deleted. Its problems and your progress on them are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={async () => {
                  await del.mutateAsync(plan.id);
                  toast.success("Plan deleted");
                  void navigate({ to: "/plans" });
                }}
              >
                Delete plan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
