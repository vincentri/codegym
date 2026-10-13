import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCategories, useGenerateQuestions, usePlans } from "@/api/hooks";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  generateFormSchema,
  type GenerateForm,
  type GeneratedQuestion,
  type GenerateProgress,
} from "@/schemas";
import { GeneratedReview } from "./GeneratedReview";

const STEPS: { key: Exclude<GenerateProgress, "done">; label: string }[] = [
  { key: "writing", label: "Writing original questions" },
  { key: "testing", label: "Generating test cases" },
  { key: "verifying", label: "Verifying answers with a reference solution" },
];

function Progress({ step }: { step: GenerateProgress | null }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="grid gap-2 py-2 text-sm" aria-live="polite">
      {STEPS.map((s, i) => {
        const done = step === "done" || i < current;
        const active = i === current;
        return (
          <li
            key={s.key}
            className={cn("flex items-center gap-2", !done && !active && "text-muted-foreground")}
          >
            {done ? (
              <CheckIcon className="size-4 text-primary" />
            ) : active ? (
              <Spinner className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

const DEFAULTS: GenerateForm = {
  topic: "",
  difficulty: "medium",
  count: "3",
  notes: "",
  planId: "none",
};

export function GenerateQuestionsDialog({
  triggerVariant = "default",
}: {
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GeneratedQuestion[] | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const { data: categories } = useCategories();
  const { data: plans } = usePlans();
  const generate = useGenerateQuestions();
  const form = useForm<GenerateForm>({
    resolver: zodResolver(generateFormSchema),
    defaultValues: DEFAULTS,
  });

  const close = () => {
    setOpen(false);
    setResults(null);
    form.reset(DEFAULTS);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const plan = values.planId === "none" ? null : values.planId;
    setPlanId(plan);
    try {
      setResults(
        await generate.mutateAsync({
          topic: values.topic,
          difficulty: values.difficulty,
          count: Number(values.count),
          notes: values.notes,
          planId: plan,
        }),
      );
    } catch (e) {
      toast.error("Generation failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <SparklesIcon /> Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate questions with AI</DialogTitle>
          <DialogDescription>
            The active AI model writes original questions with tests. CodeGym then runs the AI's
            reference solution to check every expected answer before you see them.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <GeneratedReview items={results} planId={planId} onDone={close} />
        ) : generate.isPending ? (
          <Progress step={generate.step} />
        ) : (
          <Form {...form}>
            <form noValidate onSubmit={onSubmit} className="grid gap-4">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Sliding Window, Graphs, Bit manipulation"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex flex-wrap gap-1">
                      {categories?.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={() => form.setValue("topic", c.name, { shouldValidate: true })}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid items-start gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How many</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" placeholder="1–5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Add to study plan</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Don't add</SelectItem>
                          {plans
                            ?.filter((p) => !p.builtin)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes <span className="text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Interview style, should need a heap, a bit easier than Two Sum…"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Questions are written in CodeGym's own words, never copied from other sites.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  <SparklesIcon /> Generate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
