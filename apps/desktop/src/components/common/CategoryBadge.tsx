import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, type CategoryColor, type CategoryRef } from "@/schemas";

export function colorValue(color: string): string {
  return CATEGORY_COLORS[color as CategoryColor] ?? CATEGORY_COLORS.slate;
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: colorValue(color) }}
    />
  );
}

export function CategoryBadge({ category }: { category: CategoryRef }) {
  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <ColorDot color={category.color} />
      {category.name}
    </Badge>
  );
}

export function CategoryBadges({ categories }: { categories: CategoryRef[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((c) => (
        <CategoryBadge key={c.id} category={c} />
      ))}
    </div>
  );
}
