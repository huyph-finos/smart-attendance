"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

const agentTypes = [
  { value: "chatbot", label: "HR Chatbot" },
  { value: "report", label: "Report Generator" },
  { value: "anomaly", label: "Anomaly Detector" },
  { value: "shift", label: "Shift Optimizer" },
  { value: "predictive", label: "Predictive Analytics" },
];

const examplePrompts = [
  "Ai di tre nhieu nhat thang nay?",
  "Ty le cham cong tuan nay?",
  "Bao cao chi nhanh HCM-Q1",
  "Show me overtime trends this month",
  "Who has the best attendance rate?",
];

function ToolCallPanel({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-muted/50 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/80"
      >
        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium">{toolCall.name}</span>
        {expanded ? (
          <ChevronDown className="ml-auto h-3 w-3" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Input:</p>
            <pre className="overflow-x-auto rounded bg-background p-2 text-[11px]">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Result:</p>
              <pre className="overflow-x-auto rounded bg-background p-2 text-[11px]">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatbotPage() {
  const searchParams = useSearchParams();
  const initialAgent = searchParams.get("agent") ?? "chatbot";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentType, setAgentType] = useState(initialAgent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

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
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const result = response.data ?? response;
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result?.content ?? result?.message ?? "No response received.",
        toolCalls: result?.toolCalls ?? [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          err?.response?.data?.message ??
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Agent selector */}
      <div className="mb-4 flex items-center gap-3">
        <Select value={agentType} onValueChange={(v) => { if (v) setAgentType(v); }}>
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
            onClick={() => setMessages([])}
          >
            New conversation
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
                <h3 className="text-lg font-semibold">
                  AI Assistant
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask me anything about attendance, HR policies, or generate
                  reports
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {examplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleExampleClick(prompt)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {/* Tool calls */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="space-y-1.5">
                        {message.toolCalls.map((tc, i) => (
                          <ToolCallPanel key={i} toolCall={tc} />
                        ))}
                      </div>
                    )}

                    <p className="px-1 text-[10px] text-muted-foreground">
                      {message.timestamp.toLocaleTimeString("en-US", {
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

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
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
              placeholder="Type your message..."
              disabled={isProcessing}
              autoFocus
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isProcessing}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
