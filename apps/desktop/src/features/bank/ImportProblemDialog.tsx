import { zodResolver } from "@hookform/resolvers/zod";
import { FileInputIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useImportProblem } from "@/api/hooks";
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
import { importProblemFormSchema, type GeneratedQuestion, type ImportProblemForm } from "@/schemas";
import { GeneratedReview } from "./GeneratedReview";

export function ImportProblemDialog() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<GeneratedQuestion | null>(null);
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

  const close = () => {
    setOpen(false);
    setPreview(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileInputIcon /> Import text
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a problem from text</DialogTitle>
          <DialogDescription>
            Paste a problem you found. The AI writes the function signature and test cases, then
            CodeGym runs a reference solution to double-check every expected answer.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <GeneratedReview items={[preview]} planId={null} onDone={close} />
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
