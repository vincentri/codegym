import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import {
  BotIcon,
  BrainCircuitIcon,
  BugIcon,
  EyeIcon,
  GaugeIcon,
  LightbulbIcon,
  ListChecksIcon,
  PlugIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAiProfiles, useChat, useClearChat, useSetActiveAiProfile } from "@/api/hooks";
import { useMentorStream } from "@/api/use-mentor-stream";
import { Markdown } from "@/components/common/Markdown";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  chatInputSchema,
  MENTOR_ACTIONS,
  type ChatInput,
  type Language,
  type MentorMode,
  type Problem,
  type RunResult,
} from "@/schemas";

const ACTION_ICONS: Record<Exclude<MentorMode, "chat">, LucideIcon> = {
  hint: LightbulbIcon,
  explain: BrainCircuitIcon,
  review: ListChecksIcon,
  debug: BugIcon,
  complexity: GaugeIcon,
  approach: BotIcon,
  solution: EyeIcon,
};

function Bubble({ from, children }: { from: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2", from === "user" && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          from === "user" ? "bg-secondary" : "bg-primary text-primary-foreground",
        )}
      >
        {from === "user" ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-lg px-3 py-2",
          from === "user" ? "bg-secondary text-sm" : "bg-card ring-1 ring-border",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ConnectAiCard() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlugIcon />
        </EmptyMedia>
        <EmptyTitle>Connect an AI mentor</EmptyTitle>
        <EmptyDescription>
          Pick any provider: a free local model with Ollama, OpenCode Zen, Claude, or your own
          OpenAI-compatible URL.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/settings" search={{ tab: "ai" }}>
            Set up AI mentor
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function MentorPanel({
  problem,
  language,
  getCode,
  lastRun,
}: {
  problem: Problem;
  language: Language;
  getCode: () => string;
  lastRun: RunResult | null;
}) {
  const { data: profiles } = useAiProfiles();
  const setActive = useSetActiveAiProfile();
  const { data: messages } = useChat(problem.id);
  const clearChat = useClearChat();
  const { send, cancel, streaming, pending, error } = useMentorStream(problem.id);
  const [confirmSolution, setConfirmSolution] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const form = useForm<ChatInput>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: { message: "" },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, pending?.answer]);

  const active = profiles?.find((p) => p.isActive);

  const ask = (mode: MentorMode, message: string) =>
    void send({ mode, message, language, code: getCode(), lastRun });

  const onSubmit = form.handleSubmit(({ message }) => {
    ask("chat", message);
    form.reset({ message: "" });
  });

  if (profiles && profiles.length === 0) return <ConnectAiCard />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <BotIcon className="size-4 text-primary" />
        <span className="text-sm font-medium">Mentor</span>
        <div className="ml-auto flex items-center gap-1">
          <Select value={active?.id ?? ""} onValueChange={(id) => setActive.mutate(id)}>
            <SelectTrigger size="sm" className="h-7 max-w-48 text-xs" aria-label="AI model">
              <SelectValue placeholder="Choose model" />
            </SelectTrigger>
            <SelectContent align="end">
              {profiles?.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name} · {p.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Clear conversation"
                disabled={!messages?.length || streaming}
                onClick={() => clearChat.mutate(problem.id)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear conversation</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {MENTOR_ACTIONS.map((a) => {
          const Icon = ACTION_ICONS[a.mode];
          return (
            <Button
              key={a.mode}
              variant={a.mode === "solution" ? "ghost" : "outline"}
              size="sm"
              className={cn("h-7 text-xs", a.mode === "solution" && "text-muted-foreground")}
              disabled={streaming}
              onClick={() =>
                a.mode === "solution" ? setConfirmSolution(true) : ask(a.mode, a.prompt)
              }
            >
              <Icon className="size-3.5" /> {a.label}
            </Button>
          );
        })}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-3 p-3">
          {!messages?.length && !pending && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Stuck? Ask for a hint. I'll guide you toward the answer without giving it away.
            </p>
          )}
          {messages?.map((m) => (
            <Bubble key={m.id} from={m.role}>
              {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
            </Bubble>
          ))}
          {pending && (
            <>
              <Bubble from="user">{pending.question}</Bubble>
              <Bubble from="assistant">
                {pending.answer ? (
                  <Markdown>{pending.answer}</Markdown>
                ) : (
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                )}
              </Bubble>
            </>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Form {...form}>
        <form noValidate onSubmit={onSubmit} className="border-t p-2">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <div className="relative">
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Ask anything about this problem…  (Enter to send, Shift+Enter for a new line)"
                      className="max-h-40 min-h-16 resize-none pr-11 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void onSubmit();
                        }
                      }}
                      {...field}
                    />
                  </FormControl>
                  {streaming ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 bottom-2 size-7"
                      aria-label="Stop"
                      onClick={cancel}
                    >
                      <SquareIcon className="size-3" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-2 bottom-2 size-7"
                      aria-label="Send"
                    >
                      <SendIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <AlertDialog open={confirmSolution} onOpenChange={setConfirmSolution}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal the full solution?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll learn more by asking for another hint first. Revealing the solution is recorded
              on this problem, but you can still solve it yourself afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => ask("hint", MENTOR_ACTIONS[0]!.prompt)}>
              Give me a hint instead
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => ask("solution", MENTOR_ACTIONS.at(-1)!.prompt)}>
              Show solution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
