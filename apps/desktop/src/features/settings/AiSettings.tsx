import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2Icon,
  KeyRoundIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  useAiProfiles,
  useDeleteAiProfile,
  useListModels,
  useSaveAiProfile,
  useSetActiveAiProfile,
  useTestConnection,
} from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/features/workspace/format";
import { cn } from "@/lib/utils";
import {
  aiProfileFormSchema,
  emptyProfileForm,
  profileFormFromProfile,
  PROVIDER_PRESETS,
  providerKindSchema,
  type AiProfile,
  type AiProfileForm,
  type ConnectionTest,
  type ProviderKind,
} from "@/schemas";

const PROVIDERS = providerKindSchema.options;

function ProfileForm({
  initial,
  onSaved,
  onDeleted,
}: {
  initial: AiProfileForm;
  onSaved: (p: AiProfile) => void;
  onDeleted: () => void;
}) {
  const save = useSaveAiProfile();
  const del = useDeleteAiProfile();
  const listModels = useListModels();
  const testConnection = useTestConnection();
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<ConnectionTest | null>(null);

  const form = useForm<AiProfileForm>({
    resolver: zodResolver(aiProfileFormSchema),
    defaultValues: initial,
  });
  const provider = useWatch({ control: form.control, name: "provider" });
  const hasStoredKey = useWatch({ control: form.control, name: "hasStoredKey" });
  const preset = PROVIDER_PRESETS[provider];

  const changeProvider = (next: ProviderKind) => {
    const p = PROVIDER_PRESETS[next];
    form.setValue("provider", next);
    form.setValue("baseUrl", p.baseUrl, { shouldValidate: form.formState.isSubmitted });
    form.setValue("model", p.defaultModel);
    if (!form.getValues("id")) form.setValue("name", p.label);
    setModels([]);
    setTest(null);
  };

  /** Validates the form, then runs a backend action with the values. */
  const withValid = (fn: (values: AiProfileForm) => Promise<void>) =>
    form.handleSubmit(async (values) => {
      try {
        await fn(values);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });

  const fetchModels = async () => {
    const ok = await form.trigger(["baseUrl", "apiKey"]);
    if (!ok) return;
    try {
      const list = await listModels.mutateAsync(form.getValues());
      setModels(list);
      if (list.length === 0)
        toast.info("The provider returned no models. Type the model name instead.");
    } catch (e) {
      toast.error("Could not fetch models", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={withValid(async (values) => {
          const saved = await save.mutateAsync(values);
          toast.success("Profile saved");
          onSaved(saved);
        })}
        className="grid gap-5"
      >
        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider</FormLabel>
              <Select value={field.value} onValueChange={(v) => changeProvider(v as ProviderKind)}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_PRESETS[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{preset.description}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="baseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base URL</FormLabel>
                <FormControl>
                  <Input
                    className="font-mono text-xs"
                    placeholder="http://localhost:1234/v1"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {provider !== "ollama" && (
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  API key{" "}
                  {!preset.keyRequired && <span className="text-muted-foreground">(optional)</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="off"
                    className="font-mono text-xs"
                    placeholder={
                      hasStoredKey
                        ? "•••••••• stored in your OS keychain (leave blank to keep)"
                        : "Paste your key"
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription className="flex items-center gap-1.5">
                  <KeyRoundIcon className="size-3.5" /> Saved in your operating system's keychain,
                  never in the database.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    className="font-mono text-xs"
                    placeholder="Type a model name or fetch the list"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchModels()}
                  disabled={listModels.isPending}
                >
                  {listModels.isPending ? <Spinner /> : <RefreshCwIcon />} Fetch models
                </Button>
              </div>
              {models.length > 0 && (
                <Select
                  value={models.includes(field.value) ? field.value : ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full" aria-label="Available models">
                    <SelectValue placeholder={`Pick from ${models.length} available models`} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="mentorStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mentor style</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="socratic">Socratic: guides with questions</SelectItem>
                    <SelectItem value="direct">Direct: explains straight away</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {provider === "anthropic" && (
            <FormField
              control={form.control}
              name="effort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effort</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low: fastest, cheapest</SelectItem>
                      <SelectItem value="medium">Medium: balanced</SelectItem>
                      <SelectItem value="high">High: deepest reasoning</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {test && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              test.ok ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive",
            )}
          >
            {test.ok ? <CheckCircle2Icon className="size-4" /> : <XCircleIcon className="size-4" />}
            {test.ok ? `Connected · ${formatDuration(test.latencyMs ?? 0)}` : test.error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={testConnection.isPending}
            onClick={() =>
              void withValid(async (values) => {
                setTest(await testConnection.mutateAsync(values));
              })()
            }
          >
            {testConnection.isPending && <Spinner />} Test connection
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Spinner />} Save profile
          </Button>
          {initial.id && (
            <Button
              type="button"
              variant="ghost"
              className="ml-auto text-destructive"
              onClick={async () => {
                await del.mutateAsync(initial.id!);
                toast.success("Profile deleted");
                onDeleted();
              }}
            >
              <Trash2Icon /> Delete
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export function AiSettings() {
  const { data: profiles } = useAiProfiles();
  const setActive = useSetActiveAiProfile();
  // Each edit session gets its own key so the form remounts with fresh state.
  const [selected, setSelected] = useState<{ form: AiProfileForm; key: number } | null>(null);
  const select = (form: AiProfileForm) =>
    setSelected((prev) => ({ form, key: (prev?.key ?? 0) + 1 }));

  const fallback = profiles
    ? profiles.length
      ? profileFormFromProfile(profiles.find((p) => p.isActive) ?? profiles[0]!)
      : emptyProfileForm("ollama")
    : null;
  const editing = selected?.form ?? fallback;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="h-fit gap-2 py-3">
        <CardHeader className="px-3">
          <CardTitle className="text-sm">Profiles</CardTitle>
          <CardDescription className="text-xs">
            The active profile powers the mentor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 px-2">
          {profiles?.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5",
                editing?.id === p.id ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <button
                type="button"
                aria-label={`Use ${p.name}`}
                className={cn(
                  "size-3.5 shrink-0 rounded-full border-2",
                  p.isActive ? "border-primary bg-primary" : "border-muted-foreground",
                )}
                onClick={() => setActive.mutate(p.id)}
              />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => select(profileFormFromProfile(p))}
              >
                <div className="truncate text-sm">{p.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {p.model}
                </div>
              </button>
              {p.isActive && <Badge className="h-5 text-[10px]">Active</Badge>}
            </div>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-1 justify-start">
                <PlusIcon /> Add profile
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PROVIDERS.map((p) => (
                <DropdownMenuItem key={p} onSelect={() => select(emptyProfileForm(p))}>
                  {PROVIDER_PRESETS[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{editing?.id ? "Edit profile" : "New profile"}</CardTitle>
          <CardDescription>
            Choose where the mentor's answers come from. You can save several profiles and switch
            between them from the mentor panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editing && (
            <ProfileForm
              key={selected?.key ?? "default"}
              initial={editing}
              onSaved={(p) => select(profileFormFromProfile(p))}
              onDeleted={() => setSelected(null)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
