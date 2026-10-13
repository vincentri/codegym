import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { z } from "zod";
import { CategoriesPage } from "@/features/bank/CategoriesPage";
import { QuestionEditorPage } from "@/features/bank/QuestionEditorPage";
import { QuestionsPage } from "@/features/bank/QuestionsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PlanPage } from "@/features/plans/PlanPage";
import { PlansPage } from "@/features/plans/PlansPage";
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

export const sourceFilterSchema = z.enum(["all", "builtin", "mine"]);
export type SourceFilter = z.infer<typeof sourceFilterSchema>;

export const problemsSearchSchema = z.object({
  source: sourceFilterSchema.optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  plan: z.string().optional().catch(undefined),
});

const problemsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/problems",
  validateSearch: problemsSearchSchema,
  component: ProblemsPage,
});

const plansRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/plans",
  component: PlansPage,
});
const planRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/plans/$planId",
  component: PlanPage,
});

const bankIndexRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/bank",
  beforeLoad: () => {
    throw redirect({ to: "/bank/questions" });
  },
});
const questionsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/bank/questions",
  validateSearch: z.object({
    source: z.enum(["builtin", "mine", "ai_generated"]).optional().catch(undefined),
  }),
  component: QuestionsPage,
});
const newQuestionRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/bank/questions/new",
  /** `from`: duplicate an existing question; `draft`: open the unsaved AI draft. */
  validateSearch: z.object({
    from: z.string().optional().catch(undefined),
    draft: z.boolean().optional().catch(undefined),
  }),
  component: QuestionEditorPage,
});
const editQuestionRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/bank/questions/$questionId/edit",
  component: QuestionEditorPage,
});
const categoriesRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/bank/categories",
  component: CategoriesPage,
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
    plansRoute,
    planRoute,
    bankIndexRoute,
    questionsRoute,
    newQuestionRoute,
    editQuestionRoute,
    categoriesRoute,
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
