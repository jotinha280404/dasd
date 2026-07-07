import type { CalendarAction, ChatMessage, ChatRole } from "@dasd/cal-shared";
import { cn } from "@dasd/ui";
import { CheckCircle2, Info, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useChat } from "../api/queries";

interface ThreadItem {
  id: string;
  role: ChatRole;
  content: string;
  actions?: CalendarAction[];
  usedRealClaude?: boolean;
}

const SUGGESTIONS = [
  "Schedule lunch with Sam Friday noon",
  "What's on next week?",
  "Book a dentist appointment tomorrow at 3pm",
  "Move my standup to 10am",
];

const ACTION_ICON: Record<CalendarAction["type"], typeof CheckCircle2> = {
  create: CheckCircle2,
  update: CheckCircle2,
  delete: Trash2,
  list: Info,
};

function ActionChip({ action }: { action: CalendarAction }) {
  const Icon = ACTION_ICON[action.type];
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon size={12} className="shrink-0 text-[var(--color-success)]" aria-hidden />
      <span className="truncate">{action.summary}</span>
    </span>
  );
}

function Bubble({ item }: { item: ThreadItem }) {
  const isUser = item.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
            : "border border-border bg-surface text-foreground",
        )}
      >
        {item.content}
      </div>
      {item.actions && item.actions.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap gap-1">
          {item.actions.map((action, i) => (
            <ActionChip key={`${item.id}-${i}`} action={action} />
          ))}
        </div>
      )}
      {item.role === "assistant" && item.usedRealClaude === false && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Info size={11} aria-hidden /> Using placeholder assistant — sign in to Claude Code for
          full natural language.
        </span>
      )}
    </div>
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ThreadItem[]>([]);
  const [input, setInput] = useState("");
  const chat = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;
    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: nanoid(), role: "user", content: trimmed }]);
    setInput("");
    try {
      const res = await chat.mutateAsync({
        message: trimmed,
        history,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: new Date().toISOString(),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: res.reply,
          actions: res.actions,
          usedRealClaude: res.usedRealClaude,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: `Sorry — I couldn't reach the assistant. (${message})`,
        },
      ]);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles size={16} className="text-[var(--color-primary)]" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Message me to manage your calendar in plain language — create, move, list, or cancel
              events.
            </p>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Try
              </span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((item) => <Bubble key={item.id} item={item} />)
        )}
        {chat.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the assistant…"
            className="h-10 flex-1 rounded-md border border-border bg-[var(--color-input)] px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={chat.isPending || input.trim().length === 0}
            aria-label="Send"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)] transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
