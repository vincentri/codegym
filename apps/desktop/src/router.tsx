import {
  createHashHistory,
  type RouterHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ProblemsPage } from "@/features/problems/ProblemsPage";
import {
  AiSettingsPage,
  DataSettingsPage,
  EditorSettingsPage,
  LanguagesSettingsPage,
} from "@/features/settings/SettingsPages";
import { AppShell } from "@/features/shell/AppShell";

const rootRoute = createRootRoute({ component: Outlet });

/** Pages with the sidebar. The workspace sits outside this layout so it gets the full width. */
const appLayout = createRoute({ getParentRoute: () => rootRoute, id: "app", component: AppShell });

// Paths stay literal in each createRoute call so links are type-checked.
const dashboardRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/",
  component: DashboardPage,
});

export const problemsSearchSchema = z.object({
  source: z.enum(["custom"]).optional().catch(undefined),
});

const problemsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/problems",
  validateSearch: problemsSearchSchema,
  component: ProblemsPage,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/settings",
  beforeLoad: () => {
    throw redirect({ to: "/settings/ai" });
  },
});

const aiSettingsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/settings/ai",
  component: AiSettingsPage,
});
const editorSettingsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/settings/editor",
  component: EditorSettingsPage,
});
const languagesSettingsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/settings/languages",
  component: LanguagesSettingsPage,
});
const dataSettingsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/settings/data",
  component: DataSettingsPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/problems/$problemId",
  // Lazy: keeps the Monaco editor out of the startup bundle.
  component: lazyRouteComponent(
    () => import("@/features/workspace/WorkspacePage"),
    "WorkspacePage",
  ),
});

const routeTree = rootRoute.addChildren([
  appLayout.addChildren([
    dashboardRoute,
    problemsRoute,
    settingsIndexRoute,
    aiSettingsRoute,
    editorSettingsRoute,
    languagesSettingsRoute,
    dataSettingsRoute,
  ]),
  workspaceRoute,
]);

export function createAppRouter(history: RouterHistory) {
  return createRouter({ routeTree, history });
}

// Hash history: the desktop webview serves files, so there is no server to rewrite paths.
export const router = createAppRouter(createHashHistory());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
