import { PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { QuestionForm } from "@/schemas";

/** Editable list of short lines (constraints, hints). */
export function ListField({
  name,
  label,
  addLabel,
  placeholder,
}: {
  name: "constraints" | "hints";
  label: string;
  addLabel: string;
  placeholder: string;
}) {
  const form = useFormContext<QuestionForm>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name });
  return (
    <div className="grid gap-2">
      <FormLabel>{label}</FormLabel>
      {fields.map((f, i) => (
        <FormField
          key={f.id}
          control={form.control}
          name={`${name}.${i}.value`}
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder={placeholder} {...field} />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  <XIcon />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => append({ value: "" })}
      >
        <PlusIcon /> {addLabel}
      </Button>
    </div>
  );
}
