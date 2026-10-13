import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, LockIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { usePlans } from "@/api/hooks";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanSummary } from "@/schemas";
import { PlanDialog } from "./PlanDialogs";

export function PlanProgress({ plan }: { plan: PlanSummary }) {
  const pct = plan.total ? Math.round((plan.solved / plan.total) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>
          {plan.solved} of {plan.total} solved
        </span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" aria-label={`${pct}% complete`} />
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link to="/plans/$planId" params={{ planId: plan.id }} className="hover:underline">
            {plan.name}
          </Link>
          {plan.builtin && (
            <LockIcon className="size-3.5 text-muted-foreground" aria-label="Built-in" />
          )}
        </CardTitle>
        {plan.description && (
          <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <PlanProgress plan={plan} />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">
            {plan.next ? (
              <>
                Next: <span className="text-foreground">{plan.next.title}</span>
              </>
            ) : plan.total === 0 ? (
              "No problems yet"
            ) : (
              "All done 🎉"
            )}
          </span>
          {plan.next ? (
            <Button size="sm" asChild>
              <Link to="/problems/$problemId" params={{ problemId: plan.next.id }}>
                Start next <ArrowRightIcon />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link to="/plans/$planId" params={{ planId: plan.id }}>
                Open
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PlansPage() {
  const { data: plans, isLoading } = usePlans();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Study plans"
        description="Ordered lists of problems to work through, with progress."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New plan
          </Button>
        }
      />
      <PageBody>
        {isLoading && <Skeleton className="h-40" />}
        <div className="grid items-start gap-4 md:grid-cols-2">
          {plans?.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      </PageBody>
      {creating && (
        <PlanDialog
          initial={{ id: null, name: "", description: "" }}
          onOpenChange={setCreating}
          onSaved={(plan) => void navigate({ to: "/plans/$planId", params: { planId: plan.id } })}
        />
      )}
    </>
  );
}
