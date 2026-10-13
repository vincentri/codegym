import { CheckCircle2Icon, InfoIcon, PlayIcon, WandSparklesIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { useVerifyReference } from "@/api/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, type QuestionForm, type VerifyResult } from "@/schemas";

export function ReferenceSection({
  verify,
  onVerified,
}: {
  verify: VerifyResult | null;
  onVerified: (result: VerifyResult | null) => void;
}) {
  const form = useFormContext<QuestionForm>();
  const run = useVerifyReference();

  const runVerify = async () => {
    // Inputs must be valid JSON first; expected answers may still be empty.
    const tests = form.getValues("tests");
    const inputsOk = await form.trigger(
      tests.flatMap((t, ti) => t.inputs.map((_, pi) => `tests.${ti}.inputs.${pi}.value` as const)),
    );
    const sigOk = await form.trigger(["functionName", "params"]);
    if (!inputsOk || !sigOk) {
      toast.error("Fix the highlighted test inputs first");
      return;
    }
    const v = form.getValues();
    if (!v.referenceCode.trim()) {
      form.setError("referenceCode", { message: "Paste a solution to verify" });
      return;
    }
    const parse = (text: string) => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    };
    try {
      const result = await run.mutateAsync({
        signature: { functionName: v.functionName.trim(), params: v.params, returns: v.returns },
        comparator: v.comparator,
        inPlaceArg: v.inPlaceArg === "none" ? null : Number(v.inPlaceArg),
        tests: v.tests.map((t) => ({
          input: t.inputs.map((i) => JSON.parse(i.value) as unknown),
          expected: parse(t.expected),
        })),
        language: v.referenceLanguage,
        code: v.referenceCode,
      });
      onVerified(result);
      if (result.executed) {
        const passed = result.results.filter((r) => r.passed).length;
        toast[passed === result.results.length ? "success" : "warning"](
          `Reference agrees with ${passed} of ${result.results.length} tests`,
        );
      }
    } catch (e) {
      toast.error("Couldn't run the reference", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const useOutputs = () => {
    if (!verify?.executed) return;
    for (const r of verify.results) {
      if (r.error === null) {
        form.setValue(`tests.${r.index}.expected`, JSON.stringify(r.actual), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
    onVerified({
      ...verify,
      results: verify.results.map((r) => ({ ...r, passed: r.error === null })),
    });
    toast.success("Expected answers filled in from the reference solution");
  };

  const disagreements = verify?.executed ? verify.results.filter((r) => !r.passed).length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference solution</CardTitle>
        <CardDescription>
          Optional but recommended. CodeGym runs it against every test so wrong expected answers
          can't slip in.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField
          control={form.control}
          name="referenceLanguage"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>Language</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="referenceCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  spellCheck={false}
                  className="font-mono text-xs"
                  placeholder={"function solve(nums) {\n  // a correct solution\n}"}
                  {...field}
                />
              </FormControl>
              <FormDescription>Never shown to solvers.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runVerify()}
            disabled={run.isPending}
          >
            {run.isPending ? <Spinner /> : <PlayIcon />} Verify against tests
          </Button>
          {verify?.executed && disagreements > 0 && (
            <Button type="button" variant="outline" onClick={useOutputs}>
              <WandSparklesIcon /> Use these outputs as expected
            </Button>
          )}
        </div>
        {verify && !verify.executed && verify.note && (
          <Alert>
            <InfoIcon />
            <AlertDescription>{verify.note}</AlertDescription>
          </Alert>
        )}
        {verify?.executed && disagreements === 0 && (
          <p className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2Icon className="size-4" /> The reference solution agrees with every test.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
