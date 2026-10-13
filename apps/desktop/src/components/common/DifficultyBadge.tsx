import type { Difficulty } from "@/schemas";
import { cn } from "@/lib/utils";

const STYLES: Record<Difficulty, string> = {
  easy: "text-easy",
  medium: "text-medium",
  hard: "text-hard",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span className={cn("text-xs font-medium capitalize", STYLES[difficulty], className)}>
      {difficulty}
    </span>
  );
}
