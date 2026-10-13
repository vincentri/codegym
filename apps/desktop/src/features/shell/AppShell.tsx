import { Link, Outlet } from "@tanstack/react-router";
import { Code2Icon, ListIcon, SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navLink =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function AppShell() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-sidebar px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Code2Icon className="size-4" />
          </span>
          CodeGym
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={navLink}
            activeOptions={{ exact: true }}
            activeProps={{ className: cn(navLink, "bg-accent text-foreground") }}
          >
            <ListIcon className="size-4" /> Problems
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/settings"
            search={{ tab: "ai" }}
            className={navLink}
            activeProps={{ className: cn(navLink, "bg-accent text-foreground") }}
          >
            <SettingsIcon className="size-4" /> Settings
          </Link>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
