import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useBlocker, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { CopyIcon, LockIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCreateQuestion, useQuestion, useUpdateQuestion } from "@/api/hooks";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  emptyQuestionForm,
  formFromQuestion,
  questionFormSchema,
  questionFromForm,
  type QuestionForm,
  type QuestionInput,
  type VerifyResult,
} from "@/schemas";
import { useQuestionDraftStore } from "@/stores/question-draft";
import { DetailsSection } from "./editor/DetailsSection";
import { ReferenceSection } from "./editor/ReferenceSection";
import { SignatureSection } from "./editor/SignatureSection";
import { TestsSection } from "./editor/TestsSection";

type Mode =
  | { kind: "create"; origin: QuestionInput["origin"]; forkedFrom: string | null }
  | { kind: "edit"; id: string; origin: QuestionInput["origin"] };

function EditorForm({ initial, mode }: { initial: QuestionForm; mode: Mode }) {
  const navigate = useNavigate();
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<QuestionForm>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: initial,
    mode: "onSubmit",
  });
  const dirty = form.formState.isDirty;

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !saved,
    withResolver: true,
  });

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        const input = questionFromForm(values, {
          origin: mode.origin,
          forkedFrom: mode.kind === "create" ? mode.forkedFrom : null,
        });
        if (mode.kind === "edit") await update.mutateAsync({ id: mode.id, input });
        else await create.mutateAsync(input);
        setSaved(true);
        toast.success(mode.kind === "edit" ? "Question saved" : "Question created");
        // Let the blocker see `saved` before navigating away.
        setTimeout(() => void navigate({ to: "/bank/questions" }), 0);
      } catch (e) {
        toast.error("Couldn't save", { description: e instanceof Error ? e.message : String(e) });
      }
    },
    () => toast.error("Fix the highlighted fields before saving"),
  );

  const saving = create.isPending || update.isPending;

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title={mode.kind === "edit" ? "Edit question" : "New question"}
          description={
            mode.kind === "edit"
              ? initial.title
              : "Write the problem, its signature and tests. Add a reference solution to verify them."
          }
          actions={
            <>
              <Button type="button" variant="outline" asChild>
                <Link to="/bank/questions">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <SaveIcon />} Save question
              </Button>
            </>
          }
        />
        <PageBody className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
          <DetailsSection />
          <SignatureSection />
          <TestsSection verify={verify} />
          <ReferenceSection verify={verify} onVerified={setVerify} />
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" asChild>
              <Link to="/bank/questions">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <SaveIcon />} Save question
            </Button>
          </div>
        </PageBody>
      </form>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to this question will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => blocker.proceed?.()}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}

function Loading() {
  return (
    <PageBody className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </PageBody>
  );
}

export function QuestionEditorPage() {
  const params = useParams({ strict: false }) as { questionId?: string };
  const search = useSearch({ strict: false }) as { from?: string; draft?: boolean };
  const draft = useQuestionDraftStore((s) => s.draft);
  const editId = params.questionId ?? null;
  const sourceId = editId ?? search.from ?? null;
  const source = useQuestion(sourceId);

  // Edit an existing question.
  if (editId) {
    if (!source.data) return source.error ? <NotFound /> : <Loading />;
    if (source.data.origin === "builtin") return <ReadOnly id={editId} />;
    return (
      <EditorForm
        key={editId}
        initial={formFromQuestion(source.data)}
        mode={{ kind: "edit", id: editId, origin: source.data.origin }}
      />
    );
  }

  // Duplicate: prefill from another question.
  if (search.from) {
    if (!source.data) return source.error ? <NotFound /> : <Loading />;
    const initial = formFromQuestion(source.data);
    initial.title = `${source.data.title} (copy)`;
    return (
      <EditorForm
        key={`from-${search.from}`}
        initial={initial}
        mode={{ kind: "create", origin: "manual", forkedFrom: search.from }}
      />
    );
  }

  // Unsaved AI result handed over by Generate / Import.
  if (search.draft && draft) {
    return (
      <EditorForm
        key="draft"
        initial={formFromQuestion(draft)}
        mode={{ kind: "create", origin: draft.origin, forkedFrom: null }}
      />
    );
  }

  return (
    <EditorForm
      key="new"
      initial={emptyQuestionForm()}
      mode={{ kind: "create", origin: "manual", forkedFrom: null }}
    />
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Question not found" />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This question doesn't exist</EmptyTitle>
          <EmptyDescription>It may have been deleted.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/bank/questions">Back to questions</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </>
  );
}

function ReadOnly({ id }: { id: string }) {
  return (
    <>
      <PageHeader title="Built-in question" />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>Built-in questions are read-only</EmptyTitle>
          <EmptyDescription>
            They're updated with the app. Duplicate it to make your own editable copy.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/bank/questions/new" search={{ from: id }}>
              <CopyIcon /> Duplicate to edit
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </>
  );
}
