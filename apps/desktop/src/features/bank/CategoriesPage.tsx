import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { LockIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCategories, useDeleteCategory, useSaveCategory } from "@/api/hooks";
import { colorValue } from "@/components/common/CategoryBadge";
import { PageBody, PageHeader } from "@/components/common/PageHeader";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  categoryColorSchema,
  categoryFormSchemaWithNames,
  type Category,
  type CategoryForm,
} from "@/schemas";

export function CategoryDialog({
  initial,
  onOpenChange,
}: {
  initial: CategoryForm;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: categories = [] } = useCategories();
  const save = useSaveCategory();
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categoryFormSchemaWithNames(categories)),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success(values.id ? "Category updated" : "Category created");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Group questions however you like, across any topic.</DialogDescription>
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
                    <Input placeholder="e.g. Google prep, Warm-ups, Revisit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="flex flex-wrap gap-2"
                      aria-label="Color"
                    >
                      {categoryColorSchema.options.map((c) => (
                        <ToggleGroupItem
                          key={c}
                          value={c}
                          aria-label={c}
                          className={cn(
                            "size-7 min-w-0 flex-none rounded-full! p-0 ring-offset-2 ring-offset-background data-[state=on]:ring-2 data-[state=on]:ring-foreground",
                          )}
                          style={{ background: CATEGORY_COLORS[c] }}
                        />
                      ))}
                    </ToggleGroup>
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
                    <Textarea rows={3} {...field} />
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
                {save.isPending && <Spinner />} {initial.id ? "Save" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="grid gap-3 px-4">
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ background: colorValue(c.color) }}
          />
          <div className="min-w-0 flex-1">
            <Link
              to="/problems"
              search={{ category: c.id }}
              className="font-medium hover:underline"
            >
              {c.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              {c.questionCount} {c.questionCount === 1 ? "question" : "questions"} · {c.solvedCount}{" "}
              solved
            </div>
          </div>
          {c.builtin ? (
            <LockIcon className="mt-1 size-3.5 text-muted-foreground" aria-label="Built-in" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Actions for ${c.name}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
        <Progress
          value={c.questionCount ? (c.solvedCount / c.questionCount) * 100 : 0}
          className="h-1.5"
          aria-label={`${c.solvedCount} of ${c.questionCount} solved`}
        />
      </CardContent>
    </Card>
  );
}

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const del = useDeleteCategory();
  const [editing, setEditing] = useState<CategoryForm | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const mine = categories?.filter((c) => !c.builtin) ?? [];
  const builtin = categories?.filter((c) => c.builtin) ?? [];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Tag questions to group them. Click a category to practice it."
        actions={
          <Button
            onClick={() => setEditing({ id: null, name: "", color: "blue", description: "" })}
          >
            <PlusIcon /> New category
          </Button>
        }
      />
      <PageBody>
        {isLoading && <Skeleton className="h-40" />}
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Your categories</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet. Create one to group questions your way, like “Google prep” or “Revisit”.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((c) => (
                <CategoryCard
                  key={c.id}
                  c={c}
                  onEdit={() =>
                    setEditing({
                      id: c.id,
                      name: c.name,
                      color: c.color,
                      description: c.description,
                    })
                  }
                  onDelete={() => setDeleting(c)}
                />
              ))}
            </div>
          )}
        </section>
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Built-in topics <LockIcon className="size-3.5 text-muted-foreground" />
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {builtin.map((c) => (
              <CategoryCard key={c.id} c={c} onEdit={() => {}} onDelete={() => {}} />
            ))}
          </div>
        </section>
      </PageBody>

      {editing && <CategoryDialog initial={editing} onOpenChange={() => setEditing(null)} />}
      {deleting && (
        <AlertDialog open onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{deleting.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The tag is removed from {deleting.questionCount}{" "}
                {deleting.questionCount === 1 ? "question" : "questions"}. The questions themselves
                are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await del.mutateAsync(deleting.id);
                    toast.success("Category deleted");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Delete category
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
