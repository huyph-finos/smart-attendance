"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import apiClient from "@/lib/api-client";
import { Users, Clock, AlertTriangle, TrendingUp, Trophy } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface OverviewData {
  totalEmployees: number;
  checkedInToday: number;
  lateToday: number;
  attendanceRate: number;
  recentCheckIns?: RecentCheckIn[];
}

interface TrendPoint {
  date: string;
  rate: number;
  count: number;
}

interface RecentCheckIn {
  id: string;
  employeeName: string;
  time: string;
  status: string;
}

interface BranchHeatmapItem {
  branchId: string;
  branchName: string;
  totalEmployees: number;
  checkedIn: number;
  onTime: number;
  late: number;
  attendanceRate: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [branchLeaderboard, setBranchLeaderboard] = useState<BranchHeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, trendsRes, heatmapRes] = await Promise.allSettled([
          apiClient.get("/dashboard/overview"),
          apiClient.get("/dashboard/trends"),
          apiClient.get("/dashboard/branch-heatmap"),
        ]);

        if (overviewRes.status === "fulfilled") {
          const overviewData = overviewRes.value.data.data ?? overviewRes.value.data;
          setOverview(overviewData);
          setRecentCheckIns(
            overviewData?.recentCheckIns ?? []
          );
        }
        if (trendsRes.status === "fulfilled") {
          const trendsData = trendsRes.value.data.data ?? trendsRes.value.data;
          setTrends(trendsData ?? []);
        }
        if (heatmapRes.status === "fulfilled") {
          const heatmapData = heatmapRes.value.data.data ?? heatmapRes.value.data;
          const sorted = (heatmapData ?? [])
            .sort((a: BranchHeatmapItem, b: BranchHeatmapItem) => b.attendanceRate - a.attendanceRate)
            .slice(0, 10);
          setBranchLeaderboard(sorted);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const statsCards = [
    {
      title: "Total Employees",
      value: overview?.totalEmployees ?? 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Checked In Today",
      value: overview?.checkedInToday ?? 0,
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Late Today",
      value: overview?.lateToday ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Attendance Rate",
      value: `${overview?.attendanceRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
  ];

  const displayTrends =
    trends.length > 0
      ? trends
      : Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(
            "en-US",
            { weekday: "short" }
          ),
          rate: 0,
          count: 0,
        }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.firstName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here is what is happening with your team today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) =>
          loading ? (
            <Card key={stat.title}>
              <CardContent className="p-5">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card key={stat.title}>
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bgColor}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={displayTrends}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${value}%`, "Rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent check-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentCheckIns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No check-ins yet today
              </p>
            ) : (
              <div className="space-y-3">
                {recentCheckIns.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.time}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "ON_TIME"
                          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                          : item.status === "LATE"
                          ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
                          : ""
                      }
                    >
                      {item.status === "ON_TIME"
                        ? "On Time"
                        : item.status === "LATE"
                        ? "Late"
                        : item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Branch Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Bang Xep Hang Chi Nhanh
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : branchLeaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No branch data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium w-10">#</th>
                    <th className="pb-2 pr-3 font-medium">Chi Nhanh</th>
                    <th className="pb-2 pr-3 font-medium text-right">Ty Le</th>
                    <th className="pb-2 pr-3 font-medium text-right">NV</th>
                    <th className="pb-2 font-medium text-right">Dung gio</th>
                  </tr>
                </thead>
                <tbody>
                  {branchLeaderboard.map((branch, index) => {
                    const rank = index + 1;
                    const rankDisplay =
                      rank === 1 ? "\uD83E\uDD47" : rank === 2 ? "\uD83E\uDD48" : rank === 3 ? "\uD83E\uDD49" : String(rank);
                    const rankColor =
                      rank === 1
                        ? "text-yellow-500 font-bold"
                        : rank === 2
                        ? "text-gray-400 font-bold"
                        : rank === 3
                        ? "text-amber-600 font-bold"
                        : "text-muted-foreground";

                    return (
                      <tr
                        key={branch.branchId}
                        className={`border-b last:border-0 ${
                          rank <= 3 ? "bg-muted/30" : ""
                        }`}
                      >
                        <td className={`py-2.5 pr-3 ${rankColor}`}>
                          {rankDisplay}
                        </td>
                        <td className={`py-2.5 pr-3 font-medium ${rank <= 3 ? rankColor.split(" ")[0] : ""}`}>
                          {branch.branchName}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold">
                          {branch.attendanceRate.toFixed(1)}%
                        </td>
                        <td className="py-2.5 pr-3 text-right text-muted-foreground">
                          {branch.checkedIn}/{branch.totalEmployees}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {branch.onTime}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
