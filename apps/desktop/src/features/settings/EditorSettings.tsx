import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  editorFormFromSettings,
  editorSettingsFormSchema,
  LANGUAGES,
  settingsFromEditorForm,
  type AppSettings,
  type EditorSettingsForm as EditorForm,
} from "@/schemas";

const AUTOSAVE_LABELS: Record<EditorForm["autosavePreset"], string> = {
  off: "Off (save only on Run, Submit and switching)",
  "1": "Every 1 second",
  "2": "Every 2 seconds",
  "5": "Every 5 seconds (default)",
  "10": "Every 10 seconds",
  "30": "Every 30 seconds",
  "60": "Every minute",
  custom: "Custom…",
};

export function EditorSettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const form = useForm<EditorForm>({
    resolver: zodResolver(editorSettingsFormSchema),
    defaultValues: editorFormFromSettings(settings),
  });
  const preset = useWatch({ control: form.control, name: "autosavePreset" });

  useEffect(() => {
    form.reset(editorFormFromSettings(settings));
  }, [settings, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await update.mutateAsync(settingsFromEditorForm(values));
    toast.success("Settings saved");
  });

  return (
    <Form {...form}>
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        <div className="grid items-start gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="autosavePreset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Auto-save</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(AUTOSAVE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Saves only when your code changed. Always saves before Run and Submit.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {preset === "custom" && (
            <FormField
              control={form.control}
              name="autosaveCustom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom interval (seconds)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="1–300" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid items-start gap-5 md:grid-cols-3">
          <FormField
            control={form.control}
            name="theme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Theme</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">Match system</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="editorFontSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Font size</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="editorTabSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tab size</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="2">2 spaces</SelectItem>
                    <SelectItem value="4">4 spaces</SelectItem>
                    <SelectItem value="8">8 spaces</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid items-start gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="defaultLanguage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default language</FormLabel>
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
            name="runTimeoutSeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Run time limit (seconds)</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" {...field} />
                </FormControl>
                <FormDescription>
                  Stops code that runs too long, like an infinite loop.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending && <Spinner />} Save settings
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function EditorSettings() {
  const { data } = useSettings();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor</CardTitle>
        <CardDescription>Auto-save, appearance and how code runs.</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? <EditorSettingsForm settings={data} /> : <Skeleton className="h-60" />}
      </CardContent>
    </Card>
  );
}
