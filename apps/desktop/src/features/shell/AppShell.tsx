import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BotIcon,
  CodeIcon,
  DatabaseIcon,
  FilePenLineIcon,
  LayoutDashboardIcon,
  ListIcon,
  MapIcon,
  TagsIcon,
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
  | "/plans"
  | "/bank/questions"
  | "/bank/categories"
  | "/settings/ai"
  | "/settings/editor"
  | "/settings/languages"
  | "/settings/data";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: NavPath;
  isActive: (path: string) => boolean;
};

const exact = (target: string) => (p: string) => p === target;
const prefix = (target: string) => (p: string) => p === target || p.startsWith(`${target}/`);

const OVERVIEW: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, to: "/", isActive: exact("/") },
  { label: "Problems", icon: ListIcon, to: "/problems", isActive: exact("/problems") },
  { label: "Study plans", icon: MapIcon, to: "/plans", isActive: prefix("/plans") },
];

const BANK: NavItem[] = [
  {
    label: "Questions",
    icon: FilePenLineIcon,
    to: "/bank/questions",
    isActive: prefix("/bank/questions"),
  },
  {
    label: "Categories",
    icon: TagsIcon,
    to: "/bank/categories",
    isActive: exact("/bank/categories"),
  },
];

const SETTINGS: NavItem[] = [
  { label: "AI Mentor", icon: BotIcon, to: "/settings/ai", isActive: exact("/settings/ai") },
  { label: "Editor", icon: CodeIcon, to: "/settings/editor", isActive: exact("/settings/editor") },
  {
    label: "Languages",
    icon: TerminalIcon,
    to: "/settings/languages",
    isActive: exact("/settings/languages"),
  },
  { label: "Data", icon: DatabaseIcon, to: "/settings/data", isActive: exact("/settings/data") },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton asChild tooltip={item.label} isActive={item.isActive(pathname)}>
                <Link to={item.to}>
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
        <NavGroup label="Question bank" items={BANK} />
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
