"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import apiClient from "@/lib/api-client";
import {
  Send,
  Loader2,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  Wrench,
  Sparkles,
  MessageSquare,
  Plus,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  duration?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const agentTypes = [
  { value: "hr_chatbot", label: "HR Chatbot" },
  { value: "report_generator", label: "Report Generator" },
  { value: "anomaly_detector", label: "Anomaly Detector" },
  { value: "shift_optimizer", label: "Shift Optimizer" },
  { value: "predictive", label: "Predictive Analytics" },
];

const examplePrompts = [
  "Ai đi trễ nhiều nhất tháng này?",
  "Tỷ lệ chấm công tuần qua là bao nhiêu?",
  "So sánh chi nhánh HCM và HN",
  "Báo cáo tổng hợp tháng này",
  "Nhân viên nào có overtime nhiều nhất?",
];

/* ------------------------------------------------------------------ */
/*  Simple markdown renderer                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse inline markdown (bold, italic, code) into React elements.
 * No dangerouslySetInnerHTML — immune to XSS.
 */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code` — non-greedy, no nesting
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-c-${match.index}`} className="rounded bg-background px-1 py-0.5 text-xs font-mono">
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderMarkdown(text: string) {
  if (typeof text !== "string") text = String(text ?? "");
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded-md bg-background p-3 text-xs font-mono"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      result.push(<br key={`br-${i}`} />);
      continue;
    }

    // Headings
    const h1 = line.match(/^# (.*)/);
    if (h1) {
      result.push(<p key={`line-${i}`} className="font-bold text-lg leading-relaxed">{parseInline(h1[1], `${i}`)}</p>);
      continue;
    }
    const h2 = line.match(/^## (.*)/);
    if (h2) {
      result.push(<p key={`line-${i}`} className="font-semibold text-base leading-relaxed">{parseInline(h2[1], `${i}`)}</p>);
      continue;
    }
    const h3 = line.match(/^### (.*)/);
    if (h3) {
      result.push(<p key={`line-${i}`} className="font-semibold text-sm leading-relaxed">{parseInline(h3[1], `${i}`)}</p>);
      continue;
    }

    // Bullet list
    const bullet = line.match(/^- (.*)/);
    if (bullet) {
      result.push(<p key={`line-${i}`} className="leading-relaxed">{"\u2022 "}{parseInline(bullet[1], `${i}`)}</p>);
      continue;
    }

    // Numbered list
    const numbered = line.match(/^(\d+)\. (.*)/);
    if (numbered) {
      result.push(<p key={`line-${i}`} className="leading-relaxed">{numbered[1]}. {parseInline(numbered[2], `${i}`)}</p>);
      continue;
    }

    // Regular paragraph
    result.push(<p key={`line-${i}`} className="leading-relaxed">{parseInline(line, `${i}`)}</p>);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Tool call panel (enhanced)                                         */
/* ------------------------------------------------------------------ */

function ToolCallPanel({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const resultStr =
    toolCall.result !== undefined
      ? typeof toolCall.result === "string"
        ? toolCall.result
        : JSON.stringify(toolCall.result, null, 2)
      : null;
  const isLongResult = resultStr !== null && resultStr.length > 300;
  const [resultExpanded, setResultExpanded] = useState(!isLongResult);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 text-xs dark:border-blue-800 dark:bg-blue-950/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="font-semibold text-blue-800 dark:text-blue-300">
          {toolCall.name}
        </span>
        {toolCall.duration !== undefined && (
          <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0">
            {toolCall.duration}ms
          </Badge>
        )}
        {expanded ? (
          <ChevronDown className="ml-auto h-3 w-3 text-blue-500" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3 text-blue-500" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-blue-200 px-3 py-2 space-y-2 dark:border-blue-800">
          <div>
            <p className="mb-1 font-medium text-blue-600 dark:text-blue-400">
              Input:
            </p>
            <pre className="overflow-x-auto rounded bg-background p-2 text-[11px] font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {resultStr !== null && (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  Output:
                </p>
                {isLongResult && (
                  <button
                    onClick={() => setResultExpanded(!resultExpanded)}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    {resultExpanded ? "Collapse" : "Expand"}
                  </button>
                )}
              </div>
              <pre
                className={cn(
                  "overflow-x-auto rounded bg-background p-2 text-[11px] font-mono transition-all",
                  !resultExpanded && "max-h-20 overflow-hidden"
                )}
              >
                {resultStr}
              </pre>
              {!resultExpanded && (
                <div className="relative -mt-4 h-4 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </span>
          <span className="text-xs">AI đang suy nghĩ...</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function ChatbotPage() {
  const searchParams = useSearchParams();
  const initialAgent = searchParams.get("agent") ?? "hr_chatbot";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentType, setAgentType] = useState(initialAgent);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const { data: response } = await apiClient.get("/ai/conversations");
      const list = response.data ?? response ?? [];
      setConversations(Array.isArray(list) ? list : []);
    } catch {
      // silently fail - conversations sidebar is optional
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load a specific conversation
  async function loadConversation(conv: Conversation) {
    setActiveConversationId(conv.id);
    try {
      const { data: response } = await apiClient.get(
        `/ai/conversations/${conv.id}`
      );
      const data = response.data ?? response;
      const loadedMessages: Message[] = (data.messages ?? []).map(
        (m: { id?: string; role: string; content: string; toolCalls?: ToolCall[]; createdAt?: string }) => ({
          id: m.id ?? crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
          toolCalls: m.toolCalls ?? [],
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
        })
      );
      setMessages(loadedMessages);
    } catch {
      // If loading fails, just start fresh
    }
  }

  function handleNewConversation() {
    setMessages([]);
    setActiveConversationId(null);
    inputRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isProcessing) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      const { data: response } = await apiClient.post("/ai/chat", {
        message: text,
        agentType,
        conversationId: activeConversationId,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const result = response.data ?? response;

      if (result?.conversationId && !activeConversationId) {
        setActiveConversationId(result.conversationId);
        fetchConversations();
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result?.response ?? result?.content ?? result?.message ?? "No response received.",
        toolCalls: result?.toolCalls ?? [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          axiosErr?.response?.data?.message ??
          "Sorry, an error occurred. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-4">
      {/* Conversation history sidebar */}
      {sidebarOpen && (
        <div className="hidden w-64 shrink-0 flex-col sm:flex">
          <Card className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <h3 className="text-sm font-semibold">Lịch sử hội thoại</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNewConversation}
                title="New conversation"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversationsLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-md" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">
                    Chưa có hội thoại nào
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted",
                        activeConversationId === conv.id &&
                          "bg-primary/10 text-primary"
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-medium truncate w-full">
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {conv.title ?? "Hội thoại"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground pl-4.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(conv.updatedAt ?? conv.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Agent selector */}
        <div className="mb-3 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle conversation sidebar"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Select
            value={agentType}
            onValueChange={(v) => {
              if (v) setAgentType(v);
            }}
          >
            <SelectTrigger className="w-52">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {agentTypes.map((agent) => (
                <SelectItem key={agent.value} value={agent.value}>
                  {agent.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
            >
              Hội thoại mới
            </Button>
          )}
        </div>

        {/* Chat area */}
        <Card className="flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">AI Assistant</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hỏi bất cứ điều gì về chấm công, nhân sự, hoặc tạo báo cáo
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleExampleClick(prompt)}
                      className="rounded-full border bg-background px-4 py-2 text-xs text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages */
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] space-y-2",
                        message.role === "user" ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="space-y-0.5">
                            {renderMarkdown(message.content)}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Tool calls */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="space-y-1.5">
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1"
                          >
                            <Wrench className="h-2.5 w-2.5" />
                            {message.toolCalls.length} tool call
                            {message.toolCalls.length > 1 ? "s" : ""}
                          </Badge>
                          {message.toolCalls.map((tc, i) => (
                            <ToolCallPanel key={i} toolCall={tc} />
                          ))}
                        </div>
                      )}

                      <p className="px-1 text-[10px] text-muted-foreground">
                        {message.timestamp.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isProcessing && <TypingIndicator />}
              </div>
            )}
          </div>

          {/* Input */}
          <Separator />
          <div className="p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                disabled={isProcessing}
                autoFocus
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
