import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useProblems, useSavePlan } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { planFormSchema, type PlanForm, type PlanSummary } from "@/schemas";

export function PlanDialog({
  initial,
  onOpenChange,
  onSaved,
}: {
  initial: PlanForm;
  onOpenChange: (open: boolean) => void;
  onSaved?: (plan: PlanSummary) => void;
}) {
  const save = useSavePlan();
  const form = useForm<PlanForm>({ resolver: zodResolver(planFormSchema), defaultValues: initial });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const plan = await save.mutateAsync(values);
      toast.success(values.id ? "Plan updated" : "Plan created");
      onOpenChange(false);
      onSaved?.(plan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit study plan" : "New study plan"}</DialogTitle>
          <DialogDescription>An ordered list of problems to work through.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Week 2: Trees and Graphs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="What this plan is for" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Spinner />} {initial.id ? "Save" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Searchable multi-select of problems not already in the plan. */
export function ProblemPickerDialog({
  exclude,
  onOpenChange,
  onAdd,
}: {
  exclude: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (ids: string[]) => Promise<void>;
}) {
  const { data: problems } = useProblems();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (problems ?? []).filter(
      (p) =>
        !exclude.includes(p.id) &&
        (!q ||
          p.title.toLowerCase().includes(q) ||
          p.categories.some((c) => c.name.toLowerCase().includes(q))),
    );
  }, [problems, exclude, query]);

  const toggle = (id: string) =>
    setPicked((ps) => (ps.includes(id) ? ps.filter((p) => p !== id) : [...ps, id]));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add problems</DialogTitle>
          <DialogDescription>
            Picked problems are added to the end, in the order you pick them.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search problems"
            placeholder="Search by title or category…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ScrollArea className="h-80 rounded-md border">
          <ul className="p-1">
            {options.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
                  <Checkbox checked={picked.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {p.status === "solved" && <CheckIcon className="size-4 text-primary" />}
                  <DifficultyBadge difficulty={p.difficulty} />
                </label>
              </li>
            ))}
            {options.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No problems to add.</li>
            )}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAdd(picked);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Add {picked.length || ""}{" "}
            {picked.length === 1 ? "problem" : "problems"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
