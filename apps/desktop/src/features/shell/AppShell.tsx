import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BotIcon,
  CodeIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  ListIcon,
  StarIcon,
  TerminalIcon,
  type LucideIcon,
} from "lucide-react";
import { useAiProfiles } from "@/api/hooks";
import { LogoMark } from "@/components/common/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useUiStore } from "@/stores/ui";

type NavPath =
  | "/"
  | "/problems"
  | "/settings/ai"
  | "/settings/editor"
  | "/settings/languages"
  | "/settings/data";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: NavPath;
  search?: { source: "custom" };
  isActive: (path: string, search: Record<string, unknown>) => boolean;
};

const OVERVIEW: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, to: "/", isActive: (p) => p === "/" },
  {
    label: "Problems",
    icon: ListIcon,
    to: "/problems",
    isActive: (p, s) => p === "/problems" && s.source !== "custom",
  },
  {
    label: "My problems",
    icon: StarIcon,
    to: "/problems",
    search: { source: "custom" },
    isActive: (p, s) => p === "/problems" && s.source === "custom",
  },
];

const SETTINGS: NavItem[] = [
  { label: "AI Mentor", icon: BotIcon, to: "/settings/ai", isActive: (p) => p === "/settings/ai" },
  {
    label: "Editor",
    icon: CodeIcon,
    to: "/settings/editor",
    isActive: (p) => p === "/settings/editor",
  },
  {
    label: "Languages",
    icon: TerminalIcon,
    to: "/settings/languages",
    isActive: (p) => p === "/settings/languages",
  },
  {
    label: "Data",
    icon: DatabaseIcon,
    to: "/settings/data",
    isActive: (p) => p === "/settings/data",
  },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname, search } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, search: s.location.search }),
  });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                tooltip={item.label}
                isActive={item.isActive(pathname, search as Record<string, unknown>)}
              >
                <Link to={item.to} search={item.search ?? {}}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ActiveModel() {
  const { data: profiles } = useAiProfiles();
  const active = profiles?.find((p) => p.isActive);
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="AI mentor model">
          <Link to="/settings/ai">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
              <BotIcon className="size-4 text-primary" />
            </span>
            <span className="grid min-w-0 text-left leading-tight">
              <span className="truncate text-xs text-muted-foreground">AI mentor</span>
              <span className="truncate text-sm font-medium">
                {active ? `${active.name} · ${active.model}` : "Not connected"}
              </span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="CodeGym">
              <Link to="/">
                <LogoMark />
                <span className="grid leading-tight">
                  <span className="font-semibold">CodeGym</span>
                  <span className="text-xs text-muted-foreground">Practice with a mentor</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Overview" items={OVERVIEW} />
        <NavGroup label="Settings" items={SETTINGS} />
      </SidebarContent>
      <SidebarFooter>
        <ActiveModel />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Dashboard layout: left navigation plus a page body. Used by every screen except the workspace. */
export function AppShell() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="h-full min-h-0">
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
