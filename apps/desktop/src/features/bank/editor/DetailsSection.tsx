import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CategoryPicker } from "@/components/common/CategoryPicker";
import { Markdown } from "@/components/common/Markdown";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { QuestionForm } from "@/schemas";
import { ListField } from "./ListField";

export function DetailsSection() {
  const form = useFormContext<QuestionForm>();
  const [preview, setPreview] = useState(false);
  const description = useWatch({ control: form.control, name: "descriptionMd" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>What solvers read before they start.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid items-start gap-5 md:grid-cols-[1fr_160px]">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Longest Balanced Substring" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Difficulty</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="categoryIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categories</FormLabel>
              <FormControl>
                <CategoryPicker value={field.value} onChange={field.onChange} allowCreate />
              </FormControl>
              <FormDescription>Type a new name to create a category.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="descriptionMd"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Description</FormLabel>
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={preview ? "preview" : "write"}
                  onValueChange={(v) => v && setPreview(v === "preview")}
                >
                  <ToggleGroupItem value="write">Write</ToggleGroupItem>
                  <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {preview ? (
                <div className="min-h-40 rounded-md border px-3 py-2">
                  {description.trim() ? (
                    <Markdown>{description}</Markdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              ) : (
                <FormControl>
                  <Textarea
                    rows={10}
                    className="font-mono text-xs"
                    placeholder={
                      "Explain the task in your own words. Markdown works: **bold**, `code`, lists and ``` blocks.\n\nInclude one or two worked examples."
                    }
                    {...field}
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid items-start gap-5 md:grid-cols-2">
          <ListField
            name="constraints"
            label="Constraints"
            addLabel="Add constraint"
            placeholder="1 ≤ nums.length ≤ 10⁴"
          />
          <ListField name="hints" label="Hints" addLabel="Add hint" placeholder="Try a hash map." />
        </div>
      </CardContent>
    </Card>
  );
}
