import { FlameIcon } from "lucide-react";
import { useStats } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Difficulty } from "@/schemas";

export function StatsBar() {
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
