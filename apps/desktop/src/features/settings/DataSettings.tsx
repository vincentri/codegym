import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import {
  DownloadIcon,
  FolderOpenIcon,
  PackageIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  useDataInfo,
  useExportProblemPack,
  useImportProblemPack,
  useOpenDataFolder,
  useResetProgress,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { RESET_CONFIRM_WORD, resetConfirmSchema, type ResetConfirmForm } from "@/schemas";
import { useUiStore } from "@/stores/ui";

const DELETED = [
  "Solved status and progress on every problem",
  "All submissions and their code",
  "Saved code drafts",
  "Mentor conversations",
  "Solve history, practice time and streaks",
];
const KEPT = [
  "Your settings",
  "AI profiles and API keys",
  "Built-in problems",
  "Your categories and study plans",
];

export function ResetProgressDialog() {
  const [open, setOpen] = useState(false);
  const reset = useResetProgress();
  const clearProblemPrefs = useUiStore((s) => s.clearProblemPrefs);
  const navigate = useNavigate();
  const defaults: ResetConfirmForm = { confirm: "", includeCustomProblems: false };
  const form = useForm<ResetConfirmForm>({
    resolver: zodResolver(resetConfirmSchema),
    defaultValues: defaults,
  });
  const typed = useWatch({ control: form.control, name: "confirm" });
  const ready = typed.trim() === RESET_CONFIRM_WORD;

  const onSubmit = form.handleSubmit(async ({ includeCustomProblems }) => {
    try {
      await reset.mutateAsync({ includeCustomProblems });
      clearProblemPrefs();
      setOpen(false);
      toast.success("Progress reset", {
        description: includeCustomProblems
          ? "Everything is back to zero, including the questions you created."
          : "Everything is back to zero. Your questions, categories and plans are still here.",
      });
      void navigate({ to: "/" });
    } catch (e) {
      toast.error("Reset failed", { description: e instanceof Error ? e.message : String(e) });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <RotateCcwIcon /> Reset progress
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-destructive" /> Reset all progress?
          </DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="mb-1.5 font-medium text-destructive">Deleted</div>
            <ul className="grid list-disc gap-1 pl-4 text-muted-foreground">
              {DELETED.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-1.5 font-medium">Kept</div>
            <ul className="grid list-disc gap-1 pl-4 text-muted-foreground">
              {KEPT.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        </div>

        <Form {...form}>
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <FormField
              control={form.control}
              name="includeCustomProblems"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="grid gap-1">
                    <FormLabel>Also delete questions I created</FormLabel>
                    <FormDescription>
                      Imported, AI-generated and hand-written questions. Leave unticked to keep
                      them.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Type <span className="font-mono font-semibold">{RESET_CONFIRM_WORD}</span> to
                    confirm
                  </FormLabel>
                  <FormControl>
                    <Input autoComplete="off" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={!ready || reset.isPending}>
                {reset.isPending && <Spinner />} Reset everything
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DataSettings() {
  const { data } = useDataInfo();
  const exportPack = useExportProblemPack();
  const importPack = useImportProblemPack();
  const onExport = () =>
    exportPack.mutate(undefined, {
      onSuccess: (r) =>
        r &&
        toast.success(`Exported ${r.questions} question${r.questions === 1 ? "" : "s"}`, {
          description: r.path,
        }),
      onError: (e) => toast.error(e.message),
    });
  const onImport = () =>
    importPack.mutate(undefined, {
      onSuccess: (r) => {
        if (!r) return;
        const skipped = r.skipped.map((s) => `${s.title}: ${s.reason}`).join("\n");
        const title = `Imported ${r.imported} question${r.imported === 1 ? "" : "s"}`;
        if (r.skipped.length > 0)
          toast.warning(`${title}, skipped ${r.skipped.length}`, { description: skipped });
        else toast.success(title);
      },
      onError: (e) => toast.error(e.message),
    });
  const openDataFolder = useOpenDataFolder();
  const openFolder = () =>
    openDataFolder.mutate(undefined, { onError: (e) => toast.error(e.message) });
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            Everything is stored locally in a single SQLite database on this computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {data ? (
            <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Database</dt>
              <dd className="font-mono text-xs break-all">{data.dbPath}</dd>
              <dt className="text-muted-foreground">Built-in problems</dt>
              <dd>
                {data.builtinProblems}{" "}
                <span className="text-muted-foreground">(bank {data.bankVersion})</span>
              </dd>
              <dt className="text-muted-foreground">Your problems</dt>
              <dd>{data.customProblems}</dd>
            </dl>
          ) : (
            <Skeleton className="h-20" />
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openFolder}>
              <FolderOpenIcon /> Open data folder
            </Button>
            <Button variant="outline" onClick={onExport} disabled={exportPack.isPending}>
              <DownloadIcon /> Export my problems
            </Button>
            <Button variant="outline" onClick={onImport} disabled={importPack.isPending}>
              <UploadIcon /> Import problem pack
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PackageIcon className="size-3.5" /> Problem packs are .codegym.json files you can share
            with friends.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Start over from scratch: wipe your progress, submissions, saved code and mentor chats.
            Settings and AI profiles are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetProgressDialog />
        </CardContent>
      </Card>
    </div>
  );
}
