import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudUploadIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useInitialCode,
  useProblem,
  useProblems,
  useRunCode,
  useSaveDraft,
  useSettings,
  useStarterCode,
  useSubmitCode,
} from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { LogoMark } from "@/components/common/Logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LANGUAGES,
  type AppSettings,
  type Language,
  type Problem,
  type RunResult,
} from "@/schemas";
import { useUiStore } from "@/stores/ui";
import { CodeEditor } from "./CodeEditor";
import { DescriptionPanel } from "./DescriptionPanel";
import { relativeTime } from "./format";
import { MentorPanel } from "./MentorPanel";
import { ResultsPanel, type CustomCase } from "./ResultsPanel";
import { useAutosave } from "./use-autosave";
import { usePracticeSession } from "./use-practice-session";

function SaveIndicator({ dirty, saving, savedAt, error }: ReturnType<typeof useAutosave>["state"]) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  let text = "Not saved yet";
  if (error) text = `Save failed: ${error}`;
  else if (saving) text = "Saving…";
  else if (dirty) text = "Unsaved changes";
  else if (savedAt) text = `Saved · ${relativeTime(savedAt)}`;
  return (
    <span
      className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
      aria-live="polite"
    >
      {text}
    </span>
  );
}

type EditorAreaProps = {
  problem: Problem;
  language: Language;
  settings: AppSettings;
  onLanguageChange: (l: Language) => void;
  onCodeChange: (code: string) => void;
  registerFlush: (flush: () => Promise<void>) => void;
  onRun: () => void;
  onSubmit: () => void;
  running: boolean;
  submitting: boolean;
};

/** Editor for one (problem, language) pair. Re-mounted when either changes. */
function EditorArea(props: EditorAreaProps) {
  const initial = useInitialCode(props.problem.id, props.language);
  if (!initial.data) {
    return (
      <div className="grid gap-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  return (
    <LoadedEditor
      {...props}
      initialCode={initial.data.code}
      initialSavedAt={initial.data.savedAt ? new Date(initial.data.savedAt) : null}
    />
  );
}

function LoadedEditor({
  problem,
  language,
  settings,
  onLanguageChange,
  onCodeChange,
  registerFlush,
  onRun,
  onSubmit,
  running,
  submitting,
  initialCode,
  initialSavedAt,
}: EditorAreaProps & { initialCode: string; initialSavedAt: Date | null }) {
  const starter = useStarterCode(problem.id, language);
  const saveDraft = useSaveDraft();
  const [code, setCode] = useState(initialCode);

  const autosave = useAutosave({
    initialCode,
    initialSavedAt,
    intervalSeconds: settings.autosaveSeconds,
    save: (c) => saveDraft.mutateAsync({ problemId: problem.id, language, code: c }),
  });

  useEffect(() => onCodeChange(initialCode), [initialCode, onCodeChange]);

  useEffect(() => registerFlush(autosave.flush), [registerFlush, autosave.flush]);

  const change = (next: string) => {
    setCode(next);
    onCodeChange(next);
    autosave.setCode(next);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Select
          value={language}
          onValueChange={(l) => {
            void autosave.flush();
            onLanguageChange(l as Language);
          }}
        >
          <SelectTrigger size="sm" className="h-7 w-48 text-xs" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.id} value={l.id} className="text-xs">
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Reset to starter code"
                >
                  <RotateCcwIcon className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Reset to starter code</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to starter code?</AlertDialogTitle>
              <AlertDialogDescription>
                Your current code is replaced. You can still press Ctrl+Z in the editor to get it
                back until you leave this problem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => starter.data !== undefined && change(starter.data)}>
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <SaveIndicator {...autosave.state} />
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-7"
                disabled={running || submitting}
                onClick={onRun}
              >
                {running ? <Spinner className="size-3.5" /> : <PlayIcon className="size-3.5" />} Run
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Run example tests <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-7" disabled={running || submitting} onClick={onSubmit}>
                {submitting ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <CloudUploadIcon className="size-3.5" />
                )}{" "}
                Submit
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Run all tests <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={code}
          language={language}
          fontSize={settings.editorFontSize}
          tabSize={settings.editorTabSize}
          onChange={change}
          onRun={onRun}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function ProblemNav({ problem }: { problem: Problem }) {
  const { data: problems } = useProblems();
  const navigate = useNavigate();
  const idx = problems?.findIndex((p) => p.id === problem.id) ?? -1;
  const prev = idx > 0 ? problems?.[idx - 1] : undefined;
  const next = idx >= 0 ? problems?.[idx + 1] : undefined;
  const go = (id: string) =>
    void navigate({ to: "/problems/$problemId", params: { problemId: id } });
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!prev}
        onClick={() => prev && go(prev.id)}
        aria-label="Previous problem"
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!next}
        onClick={() => next && go(next.id)}
        aria-label="Next problem"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

function Workspace({ problem, settings }: { problem: Problem; settings: AppSettings }) {
  usePracticeSession(problem.id);
  const { mentorOpen, toggleMentor, languageByProblem, setLanguage } = useUiStore();
  const language = languageByProblem[problem.id] ?? settings.defaultLanguage;
  const codeRef = useRef("");
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const runCode = useRunCode();
  const submitCode = useSubmitCode();
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [resultId, setResultId] = useState(0);
  const [resultsTab, setResultsTab] = useState<"cases" | "result">("cases");
  const [customCases, setCustomCases] = useState<CustomCase[]>([]);

  const onCodeChange = useCallback((c: string) => {
    codeRef.current = c;
  }, []);
  const registerFlush = useCallback((f: () => Promise<void>) => {
    flushRef.current = f;
  }, []);

  const busy = runCode.isPending || submitCode.isPending;

  const run = async () => {
    if (busy) return;
    await flushRef.current();
    setResultsTab("result");
    try {
      const result = await runCode.mutateAsync({
        problemId: problem.id,
        language,
        code: codeRef.current,
        customInputs: customCases.map((c) => c.args),
      });
      setLastRun(result);
      setResultId((n) => n + 1);
    } catch (e) {
      toast.error("Run failed", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const submit = async () => {
    if (busy) return;
    await flushRef.current();
    setResultsTab("result");
    try {
      const { run: result, firstSolve } = await submitCode.mutateAsync({
        problemId: problem.id,
        language,
        code: codeRef.current,
        customInputs: [],
      });
      setLastRun(result);
      setResultId((n) => n + 1);
      if (result.verdict === "accepted") {
        toast.success(firstSolve ? "Solved! 🎉" : "Accepted", {
          description: firstSolve
            ? `${problem.title} is marked as solved.`
            : `All ${result.total} tests passed.`,
        });
      }
    } catch (e) {
      toast.error("Submit failed", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-sidebar px-2">
        <Link to="/" aria-label="CodeGym dashboard" className="ml-1">
          <LogoMark className="size-6" />
        </Link>
        <Button variant="ghost" size="sm" className="h-7" asChild>
          <Link to="/problems">
            <ChevronLeftIcon /> Problems
          </Link>
        </Button>
        <span className="truncate text-sm font-medium">
          {problem.number}. {problem.title}
        </span>
        <DifficultyBadge difficulty={problem.difficulty} />
        <ProblemNav problem={problem} />
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="h-7" onClick={toggleMentor}>
            {mentorOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            {mentorOpen ? "Hide mentor" : "Show mentor"}
          </Button>
        </div>
      </div>
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="description" defaultSize="30" minSize="18">
          <DescriptionPanel problem={problem} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="editor" defaultSize={mentorOpen ? "44" : "70"} minSize="30">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel id="code" defaultSize="64" minSize="25">
              <EditorArea
                key={`${problem.id}:${language}`}
                problem={problem}
                language={language}
                settings={settings}
                onLanguageChange={(l) => setLanguage(problem.id, l)}
                onCodeChange={onCodeChange}
                registerFlush={registerFlush}
                onRun={() => void run()}
                onSubmit={() => void submit()}
                running={runCode.isPending}
                submitting={submitCode.isPending}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="results" defaultSize="36" minSize="15">
              <ResultsPanel
                problem={problem}
                customCases={customCases}
                onAddCustom={(args) => setCustomCases((cs) => [...cs, { id: Date.now(), args }])}
                onRemoveCustom={(id) => setCustomCases((cs) => cs.filter((c) => c.id !== id))}
                result={lastRun}
                resultId={resultId}
                running={busy}
                tab={resultsTab}
                onTabChange={setResultsTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        {mentorOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel id="mentor" defaultSize="26" minSize="20">
              <MentorPanel
                problem={problem}
                language={language}
                getCode={() => codeRef.current}
                lastRun={lastRun}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

export function WorkspacePage() {
  const { problemId } = useParams({ from: "/problems/$problemId" });
  const problem = useProblem(problemId);
  const settings = useSettings();

  if (problem.error) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load this problem: {problem.error.message}
      </p>
    );
  }
  if (!problem.data || !settings.data) {
    return (
      <div className="grid gap-3 p-6">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <Workspace key={problem.data.id} problem={problem.data} settings={settings.data} />;
}
