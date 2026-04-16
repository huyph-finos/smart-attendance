"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileBarChart,
  AlertOctagon,
  Calendar,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const agents = [
  {
    id: "chatbot",
    title: "HR Chatbot",
    description:
      "Ask questions about attendance, leave, policies, and more in natural language. Supports Vietnamese and English.",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    href: "/dashboard/ai/chatbot",
    badge: "Interactive",
  },
  {
    id: "report",
    title: "Report Generator",
    description:
      "Generate custom attendance, overtime, and performance reports with AI-powered analysis and visualizations.",
    icon: FileBarChart,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
    href: "/dashboard/ai/chatbot?agent=report_generator",
    badge: "Automated",
  },
  {
    id: "anomaly",
    title: "Anomaly Detector",
    description:
      "Identify unusual attendance patterns, potential fraud, buddy punching, and suspicious location data.",
    icon: AlertOctagon,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
    href: "/dashboard/ai/chatbot?agent=anomaly_detector",
    badge: "Real-time",
  },
  {
    id: "shift",
    title: "Shift Optimizer",
    description:
      "AI-optimized shift scheduling based on historical patterns, employee preferences, and business demands.",
    icon: Calendar,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    href: "/dashboard/ai/chatbot?agent=shift_optimizer",
    badge: "Smart",
  },
  {
    id: "predictive",
    title: "Predictive Analytics",
    description:
      "Forecast attendance trends, identify at-risk employees, and predict staffing needs for upcoming periods.",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    href: "/dashboard/ai/chatbot?agent=predictive",
    badge: "AI",
  },
  {
    id: "insights",
    title: "AI Insights",
    description:
      "Auto-generated intelligent analysis including attendance summaries, anomaly alerts, and trend predictions powered by AI.",
    icon: Sparkles,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    href: "/dashboard/ai/insights",
    badge: "Auto",
  },
];

export default function AIHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Hub</h2>
        <p className="text-sm text-muted-foreground">
          Intelligent agents powered by AI to help you manage attendance and HR
          operations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={agent.href}>
            <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${agent.bgColor}`}
                  >
                    <agent.icon className={`h-5 w-5 ${agent.color}`} />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {agent.badge}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-base">{agent.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {agent.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open agent
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
