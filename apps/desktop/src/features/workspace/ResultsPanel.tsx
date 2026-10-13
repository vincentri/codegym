import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  customInputFormSchema,
  customInputToArgs,
  placeholderFor,
  type Problem,
  type RunResult,
  type TestResult,
} from "@/schemas";
import { formatValue, VERDICT_LABEL } from "./format";

export interface CustomCase {
  id: number;
  args: unknown[];
}

function ValueBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "error" | "muted";
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <pre
        className={cn(
          "overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap",
          tone === "error" && "bg-destructive/10 text-destructive",
        )}
      >
        {value || " "}
      </pre>
    </div>
  );
}

function ArgsView({ problem, args }: { problem: Problem; args: unknown[] }) {
  return (
    <div className="grid gap-3">
      {problem.signature.params.map((p, i) => (
        <ValueBlock key={p.name} label={`${p.name} =`} value={formatValue(args[i])} />
      ))}
    </div>
  );
}

function AddCustomCaseDialog({
  problem,
  onAdd,
}: {
  problem: Problem;
  onAdd: (args: unknown[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const schema = useMemo(() => customInputFormSchema(problem.signature), [problem.signature]);
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        problem.signature.params.map((p, i) => [
          p.name,
          formatValue(problem.examples[0]?.input[i] ?? ""),
        ]),
      ),
    [problem],
  );
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit((values) => {
    onAdd(customInputToArgs(problem.signature, values));
    setOpen(false);
    form.reset(defaults);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7">
          <PlusIcon /> Custom case
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom test case</DialogTitle>
          <DialogDescription>
            Enter each argument as JSON. Custom cases have no expected answer, so you just see your
            output.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            {problem.signature.params.map((p) => (
              <FormField
                key={p.name}
                control={form.control}
                name={p.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono">
                      {p.name}: <span className="text-muted-foreground">{p.type}</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="font-mono"
                        placeholder={placeholderFor(p.type)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
              <Button type="submit">Add case</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CaseChip({
  active,
  onClick,
  children,
  status,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  status?: boolean | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
      )}
    >
      {status === true && <span className="size-1.5 rounded-full bg-primary" />}
      {status === false && <span className="size-1.5 rounded-full bg-destructive" />}
      {children}
    </button>
  );
}

function resultLabel(r: TestResult, i: number, results: TestResult[]) {
  if (r.hidden) return `Hidden ${results.filter((x, j) => x.hidden && j <= i).length}`;
  if (r.custom) return `Custom ${results.filter((x, j) => x.custom && j <= i).length}`;
  return `Case ${i + 1}`;
}

function ResultView({ problem, result }: { problem: Problem; result: RunResult }) {
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      result.results.findIndex((r) => r.passed === false),
    ),
  );
  const current = result.results[selected] ?? result.results[0];
  const accepted = result.verdict === "accepted";
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline gap-3">
        <span
          className={cn("text-lg font-semibold", accepted ? "text-primary" : "text-destructive")}
        >
          {VERDICT_LABEL[result.verdict]}
        </span>
        <span className="text-sm text-muted-foreground">
          {result.passed}/{result.total} passed · {result.totalTimeMs} ms
        </span>
      </div>
      {result.compileOutput && (
        <ValueBlock label="Compiler output" value={result.compileOutput} tone="error" />
      )}
      <div className="flex flex-wrap gap-1">
        {result.results.map((r, i) => (
          <CaseChip
            key={r.index}
            active={i === selected}
            onClick={() => setSelected(i)}
            status={r.passed}
          >
            {r.hidden && <LockIcon className="size-3" />}
            {resultLabel(r, i, result.results)}
          </CaseChip>
        ))}
      </div>
      {current &&
        (current.hidden ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {current.passed ? (
              <CheckIcon className="size-4 text-primary" />
            ) : (
              <XIcon className="size-4 text-destructive" />
            )}
            Hidden test {current.passed ? "passed" : "failed"}. Its input stays hidden until you
            solve the problem.
          </p>
        ) : (
          <div className="grid gap-3">
            {current.input && <ArgsView problem={problem} args={current.input} />}
            {current.error ? (
              <ValueBlock label="Error" value={current.error} tone="error" />
            ) : (
              <ValueBlock label="Output" value={formatValue(current.actual)} />
            )}
            {!current.custom && (
              <ValueBlock label="Expected" value={formatValue(current.expected)} />
            )}
            {current.stdout && <ValueBlock label="Stdout" value={current.stdout} tone="muted" />}
          </div>
        ))}
    </div>
  );
}

export function ResultsPanel({
  problem,
  customCases,
  onAddCustom,
  onRemoveCustom,
  result,
  resultId,
  running,
  tab,
  onTabChange,
}: {
  problem: Problem;
  customCases: CustomCase[];
  onAddCustom: (args: unknown[]) => void;
  onRemoveCustom: (id: number) => void;
  result: RunResult | null;
  /** Changes on every run so the result view resets its selection. */
  resultId: number;
  running: boolean;
  tab: "cases" | "result";
  onTabChange: (tab: "cases" | "result") => void;
}) {
  const [selectedCase, setSelectedCase] = useState(0);
  const cases = [
    ...problem.examples.map((e, i) => ({
      key: `e${i}`,
      label: `Case ${i + 1}`,
      args: e.input,
      customId: null,
    })),
    ...customCases.map((c, i) => ({
      key: `c${c.id}`,
      label: `Custom ${i + 1}`,
      args: c.args,
      customId: c.id,
    })),
  ];
  const current = cases[Math.min(selectedCase, cases.length - 1)];

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as "cases" | "result")}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex items-center border-b px-2 py-1.5">
        <TabsList className="h-8">
          <TabsTrigger value="cases">Testcases</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
        </TabsList>
        {running && (
          <span className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" /> Running…
          </span>
        )}
      </div>
      <TabsContent value="cases" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="grid gap-3 p-3">
            <div className="flex flex-wrap items-center gap-1">
              {cases.map((c, i) => (
                <span key={c.key} className="inline-flex items-center">
                  <CaseChip active={current?.key === c.key} onClick={() => setSelectedCase(i)}>
                    {c.label}
                  </CaseChip>
                  {c.customId !== null && (
                    <button
                      type="button"
                      aria-label={`Remove ${c.label}`}
                      className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        onRemoveCustom(c.customId!);
                        setSelectedCase(0);
                      }}
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </span>
              ))}
              <AddCustomCaseDialog
                problem={problem}
                onAdd={(args) => {
                  onAddCustom(args);
                  setSelectedCase(cases.length);
                }}
              />
            </div>
            {current && <ArgsView problem={problem} args={current.args} />}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="result" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="p-3">
            {result ? (
              <ResultView key={resultId} problem={problem} result={result} />
            ) : (
              <p className="text-sm text-muted-foreground">Run your code to see results here.</p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
