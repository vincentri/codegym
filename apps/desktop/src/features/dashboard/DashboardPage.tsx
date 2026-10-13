import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CheckCircle2Icon, CompassIcon, PlayIcon, XCircleIcon } from "lucide-react";
import { useDashboard } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime, VERDICT_LABEL } from "@/features/workspace/format";
import { ImportProblemDialog } from "@/features/problems/ImportProblemDialog";
import { languageLabel, type Dashboard } from "@/schemas";
import { StatsBar } from "./StatsBar";

function ContinueCard({ data }: { data: Dashboard["continueProblem"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <PlayIcon className="size-4 text-primary" /> Continue
        </CardTitle>
        <CardDescription>Pick up the problem you were last working on.</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <div className="grid gap-3">
            <div>
              <div className="font-medium">{data.problem.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <DifficultyBadge difficulty={data.problem.difficulty} />
                <span>·</span>
                <span>
                  {data.attempts} {data.attempts === 1 ? "attempt" : "attempts"}
                </span>
                <span>·</span>
                <span>{languageLabel(data.language)}</span>
                <span>·</span>
                <span>{relativeTime(new Date(data.lastActiveAt))}</span>
              </div>
            </div>
            <Button asChild className="w-fit">
              <Link to="/problems/$problemId" params={{ problemId: data.problem.id }}>
                Resume <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 text-sm text-muted-foreground">
            Nothing in progress. Start a new problem from the list.
            <Button asChild variant="outline" className="w-fit">
              <Link to="/problems">Browse problems</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentCard({ items }: { items: Dashboard["recentSubmissions"] }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm">Recent submissions</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        {items.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            Your submissions show up here after you press Submit.
          </p>
        ) : (
          <ul className="grid">
            {items.map((s) => (
              <li key={s.id}>
                <Link
                  to="/problems/$problemId"
                  params={{ problemId: s.problemId }}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  {s.verdict === "accepted" ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircleIcon className="size-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.problemTitle}</span>
                  <span
                    className={
                      s.verdict === "accepted" ? "text-xs text-primary" : "text-xs text-destructive"
                    }
                  >
                    {VERDICT_LABEL[s.verdict]}
                  </span>
                  <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
                    {languageLabel(s.language)}
                  </Badge>
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                    {relativeTime(new Date(s.createdAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ data }: { data: Dashboard["suggestion"] }) {
  if (!data) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CompassIcon className="size-4 text-medium" /> Suggested next: {data.topic}
        </CardTitle>
        <CardDescription>
          You've solved {data.solved} of {data.total} {data.topic} problems. It's your weakest topic
          so far.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        {data.problems.map((p) => (
          <Link
            key={p.id}
            to="/problems/$problemId"
            params={{ problemId: p.id }}
            className="grid gap-1 rounded-md border p-3 text-sm transition-colors hover:bg-accent"
          >
            <span className="font-medium">{p.title}</span>
            <DifficultyBadge difficulty={p.difficulty} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data } = useDashboard();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your progress at a glance. Pick up where you left off."
        actions={<ImportProblemDialog />}
      />
      <PageBody>
        <StatsBar />
        {data ? (
          <>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <ContinueCard data={data.continueProblem} />
              <RecentCard items={data.recentSubmissions} />
            </div>
            <SuggestionCard data={data.suggestion} />
          </>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        )}
      </PageBody>
    </>
  );
}
