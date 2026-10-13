import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { starterCode } from "@/lib/starter-code";
import {
  editableParamTypes,
  LANGUAGES,
  paramTypeSchema,
  type Comparator,
  type QuestionForm,
} from "@/schemas";

const COMPARATORS: { value: Comparator; label: string }[] = [
  { value: "exact", label: "Exactly equal" },
  { value: "unordered", label: "Same items, any order" },
  { value: "unorderedNested", label: "Same groups, any order (lists of lists)" },
  { value: "float", label: "Decimal, within 0.00001" },
];

function StarterPreview() {
  const form = useFormContext<QuestionForm>();
  const [functionName, params, returns, inPlaceArg] = useWatch({
    control: form.control,
    name: ["functionName", "params", "returns", "inPlaceArg"],
  });
  const signature = {
    functionName: functionName.trim() || "solve",
    params: params.map((p, i) => ({ name: p.name.trim() || `arg${i + 1}`, type: p.type })),
    returns,
  };
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">Starter code preview</div>
      <Tabs defaultValue="python" className="gap-2">
        <TabsList className="h-8">
          {LANGUAGES.map((l) => (
            <TabsTrigger key={l.id} value={l.id} className="text-xs">
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {LANGUAGES.map((l) => (
          <TabsContent key={l.id} value={l.id}>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              {starterCode(signature, l.id, inPlaceArg === "none" ? null : Number(inPlaceArg))}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function SignatureSection() {
  const form = useFormContext<QuestionForm>();
  const { fields, append, remove, swap } = useFieldArray({ control: form.control, name: "params" });
  const params = useWatch({ control: form.control, name: "params" });

  // Every test keeps one input per parameter, in the same order.
  const syncTests = (edit: (inputs: { value: string }[]) => { value: string }[]) => {
    const tests = form.getValues("tests");
    form.setValue(
      "tests",
      tests.map((t) => ({ ...t, inputs: edit([...t.inputs]) })),
      { shouldDirty: true },
    );
  };

  const addParam = () => {
    append({ name: `arg${fields.length + 1}`, type: "int" });
    syncTests((inputs) => [...inputs, { value: "" }]);
  };
  const removeParam = (i: number) => {
    remove(i);
    syncTests((inputs) => inputs.filter((_, j) => j !== i));
    const inPlace = form.getValues("inPlaceArg");
    if (inPlace !== "none" && Number(inPlace) >= i) form.setValue("inPlaceArg", "none");
  };
  const moveParam = (i: number, j: number) => {
    swap(i, j);
    syncTests((inputs) => {
      [inputs[i], inputs[j]] = [inputs[j]!, inputs[i]!];
      return inputs;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Function signature</CardTitle>
        <CardDescription>
          Types let CodeGym generate starter code and tests for every language.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <FormField
          control={form.control}
          name="functionName"
          render={({ field }) => (
            <FormItem className="max-w-sm">
              <FormLabel>Function name</FormLabel>
              <FormControl>
                <Input className="font-mono" placeholder="twoSum" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <FormLabel>Parameters</FormLabel>
          {fields.map((f, i) => (
            <div key={f.id} className="grid items-start gap-2 sm:grid-cols-[1fr_180px_auto]">
              <FormField
                control={form.control}
                name={`params.${i}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        aria-label={`Parameter ${i + 1} name`}
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`params.${i}.type`}
                render={({ field }) => (
                  <FormItem>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger
                          className="w-full font-mono"
                          aria-label={`Parameter ${i + 1} type`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {editableParamTypes.map((t) => (
                          <SelectItem key={t} value={t} className="font-mono">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move parameter ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => moveParam(i, i - 1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move parameter ${i + 1} down`}
                  disabled={i === fields.length - 1}
                  onClick={() => moveParam(i, i + 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove parameter ${i + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => removeParam(i)}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          ))}
          <FormField
            control={form.control}
            name="params"
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
            disabled={fields.length >= 6}
            onClick={addParam}
          >
            <PlusIcon /> Add parameter
          </Button>
        </div>

        <div className="grid items-start gap-5 md:grid-cols-3">
          <FormField
            control={form.control}
            name="returns"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Returns</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full font-mono">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paramTypeSchema.options.map((t) => (
                      <SelectItem key={t} value={t} className="font-mono">
                        {t}
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
            name="comparator"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Compare answers</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMPARATORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
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
            name="inPlaceArg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Answer is modified in place</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No, the function returns it</SelectItem>
                    {params.map((p, i) => (
                      <SelectItem key={`${p.name}-${i}`} value={String(i)}>
                        Yes, in {p.name || `parameter ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>For problems like “move zeroes in the array”.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <StarterPreview />
      </CardContent>
    </Card>
  );
}
