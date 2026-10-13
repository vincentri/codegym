import { Code2Icon } from "lucide-react";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ${className ?? ""}`}
    >
      <Code2Icon className="size-4" />
    </span>
  );
}
