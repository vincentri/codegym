import { CheckIcon, EyeOffIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { placeholderFor, type QuestionForm, type VerifyResult } from "@/schemas";

export function TestsSection({ verify }: { verify: VerifyResult | null }) {
  const form = useFormContext<QuestionForm>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tests" });
  const [params, returns, inPlaceArg] = useWatch({
    control: form.control,
    name: ["params", "returns", "inPlaceArg"],
  });
  const expectedType =
    inPlaceArg === "none" ? returns : (params[Number(inPlaceArg)]?.type ?? returns);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test cases</CardTitle>
        <CardDescription>
          Write each value as JSON. Visible tests appear as examples; hidden ones only run on
          Submit. You need at least 3, with one visible.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {fields.map((f, ti) => {
          const result = verify?.executed ? verify.results.find((r) => r.index === ti) : undefined;
          return (
            <div key={f.id} className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                Test {ti + 1}
                {result &&
                  (result.passed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-primary">
                      <CheckIcon className="size-3.5" /> Reference agrees
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-destructive">
                      <XIcon className="size-3.5" />
                      {result.error
                        ? `Reference failed: ${result.error}`
                        : `Reference returned ${JSON.stringify(result.actual)}`}
                    </span>
                  ))}
                <div className="ml-auto flex items-center gap-3">
                  <FormField
                    control={form.control}
                    name={`tests.${ti}.hidden`}
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="flex items-center gap-1 text-xs font-normal">
                          <EyeOffIcon className="size-3.5" /> Hidden
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove test ${ti + 1}`}
                    onClick={() => remove(ti)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              <div className="grid items-start gap-3 md:grid-cols-2">
                {params.map((p, pi) => (
                  <FormField
                    key={`${f.id}-${pi}`}
                    control={form.control}
                    name={`tests.${ti}.inputs.${pi}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs">
                          {p.name || `arg${pi + 1}`}{" "}
                          <span className="text-muted-foreground">{p.type}</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="font-mono text-xs"
                            placeholder={placeholderFor(p.type)}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name={`tests.${ti}.expected`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs">
                        expected <span className="text-muted-foreground">{expectedType}</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="font-mono text-xs"
                          placeholder={placeholderFor(expectedType)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          );
        })}
        <FormField
          control={form.control}
          name="tests"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            append({
              inputs: params.map(() => ({ value: "" })),
              expected: "",
              hidden: fields.length > 0,
            })
          }
        >
          <PlusIcon /> Add test
        </Button>
      </CardContent>
    </Card>
  );
}
