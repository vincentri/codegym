import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import { settingsTabSchema } from "@/schemas";
import { AppShell } from "@/features/shell/AppShell";
import { ProblemsPage } from "@/features/problems/ProblemsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { WorkspacePage } from "@/features/workspace/WorkspacePage";

const rootRoute = createRootRoute({ component: AppShell });

const problemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProblemsPage,
});

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/problems/$problemId",
  component: WorkspacePage,
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  validateSearch: z.object({ tab: settingsTabSchema.catch("ai") }),
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([problemsRoute, workspaceRoute, settingsRoute]);

// Hash history: the desktop webview serves files, so there is no server to rewrite paths.
export const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
