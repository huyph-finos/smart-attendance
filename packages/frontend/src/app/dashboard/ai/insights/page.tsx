"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import apiClient from "@/lib/api-client";
import {
  Sparkles,
  RefreshCw,
  ClipboardCheck,
  ShieldAlert,
  TrendingUp,
  Wrench,
  AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InsightConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  message: string;
  agentType: string;
}

interface InsightState {
  content: string | null;
  toolCallCount: number;
  loading: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Insight card configs                                               */
/* ------------------------------------------------------------------ */

const insightConfigs: InsightConfig[] = [
  {
    id: "attendance",
    title: "Tóm tắt chấm công",
    subtitle: "Attendance Summary",
    icon: ClipboardCheck,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-l-blue-500",
    message:
      "Tóm tắt tình hình chấm công hôm nay trong 3-5 câu ngắn gọn.",
    agentType: "hr_chatbot",
  },
  {
    id: "anomaly",
    title: "Cảnh báo bất thường",
    subtitle: "Anomaly Alert",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    iconBg: "bg-red-50 dark:bg-red-950",
    borderColor: "border-l-red-500",
    message:
      "Phân tích các anomaly và gian lận phát hiện được trong tuần này. Liệt kê top 5 trường hợp đáng chú ý nhất.",
    agentType: "anomaly_detector",
  },
  {
    id: "trend",
    title: "Dự đoán xu hướng",
    subtitle: "Trend Prediction",
    icon: TrendingUp,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-l-orange-500",
    message:
      "Dựa trên dữ liệu 30 ngày qua, dự đoán xu hướng chấm công tuần tới. Có nhân viên nào có nguy cơ vắng mặt không?",
    agentType: "predictive",
  },
];

/* ------------------------------------------------------------------ */
/*  Simple markdown renderer (same as chatbot)                         */
/* ------------------------------------------------------------------ */

/**
 * Parse inline markdown (bold, italic, code) into React elements.
 * No dangerouslySetInnerHTML — immune to XSS.
 */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
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
        <code key={`${keyPrefix}-c-${match.index}`} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
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
            className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono"
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

    const bullet = line.match(/^- (.*)/);
    if (bullet) {
      result.push(<p key={`line-${i}`} className="leading-relaxed">{"\u2022 "}{parseInline(bullet[1], `${i}`)}</p>);
      continue;
    }

    const numbered = line.match(/^(\d+)\. (.*)/);
    if (numbered) {
      result.push(<p key={`line-${i}`} className="leading-relaxed">{numbered[1]}. {parseInline(numbered[2], `${i}`)}</p>);
      continue;
    }

    result.push(<p key={`line-${i}`} className="leading-relaxed">{parseInline(line, `${i}`)}</p>);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function InsightSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Insight card component                                             */
/* ------------------------------------------------------------------ */

function InsightCard({
  config,
  state,
  onRefresh,
}: {
  config: InsightConfig;
  state: InsightState;
  onRefresh: () => void;
}) {
  const Icon = config.icon;

  return (
    <Card className={`border-l-4 ${config.borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}
            >
              <Icon className={`h-4.5 w-4.5 ${config.iconColor}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                {config.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {config.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.toolCallCount > 0 && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Wrench className="h-2.5 w-2.5" />
                {state.toolCallCount} tool call
                {state.toolCallCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={state.loading}
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${state.loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {state.loading ? (
          <InsightSkeleton />
        ) : state.error ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{state.error}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Thử lại
            </Button>
          </div>
        ) : state.content ? (
          <div className="text-sm space-y-0.5">{renderMarkdown(state.content)}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function InsightsPage() {
  const [states, setStates] = useState<Record<string, InsightState>>(() => {
    const initial: Record<string, InsightState> = {};
    for (const config of insightConfigs) {
      initial[config.id] = {
        content: null,
        toolCallCount: 0,
        loading: true,
        error: null,
      };
    }
    return initial;
  });

  const fetchInsight = useCallback(async (config: InsightConfig) => {
    setStates((prev) => ({
      ...prev,
      [config.id]: { ...prev[config.id], loading: true, error: null },
    }));

    try {
      const { data: response } = await apiClient.post("/ai/chat", {
        message: config.message,
        agentType: config.agentType,
      });

      const result = response.data ?? response;
      const content =
        result?.response ?? result?.content ?? result?.message ?? "Không có phản hồi.";
      const toolCallCount = (result?.toolCalls ?? []).length;

      setStates((prev) => ({
        ...prev,
        [config.id]: {
          content,
          toolCallCount,
          loading: false,
          error: null,
        },
      }));
    } catch {
      setStates((prev) => ({
        ...prev,
        [config.id]: {
          content: null,
          toolCallCount: 0,
          loading: false,
          error: "Không thể tải dữ liệu. Vui lòng thử lại.",
        },
      }));
    }
  }, []);

  // Auto-fetch all insights on mount
  useEffect(() => {
    for (const config of insightConfigs) {
      fetchInsight(config);
    }
  }, [fetchInsight]);

  function handleRefreshAll() {
    for (const config of insightConfigs) {
      fetchInsight(config);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Insights</h2>
            <p className="text-sm text-muted-foreground">
              Phân tích thông minh - Tự động tạo bởi AI
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Làm mới tất cả
        </Button>
      </div>

      {/* Insight cards */}
      <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-1">
        {insightConfigs.map((config) => (
          <InsightCard
            key={config.id}
            config={config}
            state={states[config.id]}
            onRefresh={() => fetchInsight(config)}
          />
        ))}
      </div>
    </div>
  );
}
