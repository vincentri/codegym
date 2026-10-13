import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useImportProblem } from "@/api/hooks";
import { DifficultyBadge } from "@/components/common/DifficultyBadge";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { importProblemFormSchema, type ImportProblemForm, type Problem } from "@/schemas";

export function ImportProblemDialog() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Problem | null>(null);
  const importProblem = useImportProblem();
  const form = useForm<ImportProblemForm>({
    resolver: zodResolver(importProblemFormSchema),
    defaultValues: { text: "" },
  });

  const onSubmit = form.handleSubmit(async ({ text }) => {
    try {
      setPreview(await importProblem.mutateAsync(text));
    } catch (e) {
      toast.error("Import failed", { description: e instanceof Error ? e.message : String(e) });
    }
  });

  const reset = () => {
    setPreview(null);
    form.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <SparklesIcon /> Import problem
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a problem with AI</DialogTitle>
          <DialogDescription>
            Paste any coding problem. The AI writes the function signature and test cases, then
            CodeGym runs a reference solution to double-check every expected answer.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="grid gap-3 text-sm">
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{preview.title}</div>
                <DifficultyBadge difficulty={preview.difficulty} />
              </div>
              <code className="mt-2 block font-mono text-xs text-muted-foreground">
                {preview.signature.functionName}(
                {preview.signature.params.map((p) => `${p.name}: ${p.type}`).join(", ")}) →{" "}
                {preview.signature.returns}
              </code>
              <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                <CheckIcon className="size-4 text-primary" />
                {preview.examples.length + preview.hiddenTestCount} test cases verified against the
                reference solution
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Start over
              </Button>
              <Button
                onClick={() => {
                  toast.success("Saved to your problems", { description: preview.title });
                  setOpen(false);
                  reset();
                }}
              >
                Save to my problems
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form noValidate onSubmit={onSubmit} className="grid gap-4">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Problem statement</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={12}
                        className="max-h-80 font-mono text-xs"
                        placeholder={
                          "Given an array of integers nums and an integer k, return…\n\nExample 1:\nInput: …\nOutput: …"
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Include the examples and constraints if you have them.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={importProblem.isPending}>
                  {importProblem.isPending ? <Spinner /> : <SparklesIcon />}
                  {importProblem.isPending ? "Generating tests…" : "Generate"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
