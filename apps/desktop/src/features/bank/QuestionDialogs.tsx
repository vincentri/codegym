import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  useDeleteQuestions,
  usePlan,
  usePlans,
  useSetPlanItems,
  useSetQuestionCategories,
} from "@/api/hooks";
import { CategoryPicker } from "@/components/common/CategoryPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { BankQuestion } from "@/schemas";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * One question: edit its full category set. Several questions: add categories to all of them.
 * Tags on built-in questions are your own and never change the question itself.
 */
export function EditCategoriesDialog({
  questions,
  onOpenChange,
}: {
  questions: BankQuestion[];
  onOpenChange: (open: boolean) => void;
}) {
  const single = questions.length === 1 ? questions[0]! : null;
  const setCategories = useSetQuestionCategories();
  const schema = z.object({
    categoryIds: single
      ? z.array(z.string())
      : z.array(z.string()).min(1, "Pick at least one category to add"),
  });
  const form = useForm<{ categoryIds: string[] }>({
    resolver: zodResolver(schema),
    defaultValues: { categoryIds: single ? single.categories.map((c) => c.id) : [] },
  });

  const onSubmit = form.handleSubmit(async ({ categoryIds }) => {
    try {
      if (single) {
        const current = single.categories.map((c) => c.id);
        await setCategories.mutateAsync({
          ids: [single.id],
          add: categoryIds.filter((id) => !current.includes(id)),
          remove: current.filter((id) => !categoryIds.includes(id)),
        });
      } else {
        await setCategories.mutateAsync({
          ids: questions.map((q) => q.id),
          add: categoryIds,
          remove: [],
        });
      }
      toast.success("Categories updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {single ? "Categories" : `Add categories to ${questions.length} questions`}
          </DialogTitle>
          <DialogDescription>
            {single ? single.title : "These categories are added; existing ones stay."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <FormField
              control={form.control}
              name="categoryIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <FormControl>
                    <CategoryPicker value={field.value} onChange={field.onChange} allowCreate />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={setCategories.isPending}>
                {setCategories.isPending && <Spinner />} Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const addToPlanSchema = z.object({ planId: z.string().min(1, "Choose a study plan") });

export function AddToPlanDialog({
  questions,
  onOpenChange,
}: {
  questions: BankQuestion[];
  onOpenChange: (open: boolean) => void;
}) {
  const { data: plans } = usePlans();
  const editable = plans?.filter((p) => !p.builtin) ?? [];
  const form = useForm<z.infer<typeof addToPlanSchema>>({
    resolver: zodResolver(addToPlanSchema),
    defaultValues: { planId: "" },
  });
  const plan = usePlan(useWatch({ control: form.control, name: "planId" }));
  const setItems = useSetPlanItems();

  const onSubmit = form.handleSubmit(async ({ planId }) => {
    if (!plan.data) return;
    const existing = plan.data.items.map((p) => p.id);
    const added = questions.map((q) => q.id).filter((id) => !existing.includes(id));
    try {
      await setItems.mutateAsync({ id: planId, problemIds: [...existing, ...added] });
      toast.success(
        added.length ? `Added ${added.length} to ${plan.data.name}` : "Already in that plan",
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to study plan</DialogTitle>
          <DialogDescription>
            {questions.length === 1 ? questions[0]!.title : `${questions.length} questions`} will be
            added to the end of the plan.
          </DialogDescription>
        </DialogHeader>
        {editable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have a study plan yet.{" "}
            <Link to="/plans" className="text-primary underline-offset-4 hover:underline">
              Create one
            </Link>{" "}
            first.
          </p>
        ) : (
          <Form {...form}>
            <form noValidate onSubmit={onSubmit} className="grid gap-4">
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Study plan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {editable.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.total} problems
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={setItems.isPending}>
                  {setItems.isPending && <Spinner />} Add to plan
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteQuestionsDialog({
  questions,
  onOpenChange,
  onDeleted,
}: {
  questions: BankQuestion[];
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const del = useDeleteQuestions();
  const [busy, setBusy] = useState(false);
  const names =
    questions.length === 1 ? `“${questions[0]!.title}”` : `${questions.length} questions`;
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {names}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their submissions, saved code and mentor chats are deleted too, and they're removed from
            your study plans. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await del.mutateAsync(questions.map((q) => q.id));
                toast.success(questions.length === 1 ? "Question deleted" : "Questions deleted");
                onDeleted?.();
                onOpenChange(false);
              } catch (err) {
                toast.error(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
