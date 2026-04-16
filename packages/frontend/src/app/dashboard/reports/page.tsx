"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import apiClient from "@/lib/api-client";
import {
  Download,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  Search,
} from "lucide-react";

interface BranchOption {
  id: string;
  name: string;
}

interface ReportRow {
  id?: string;
  employeeName?: string;
  date?: string;
  status?: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: number;
  lateCount?: number;
  absentCount?: number;
  onTimeCount?: number;
  attendanceRate?: number;
  [key: string]: unknown;
}

interface ReportStats {
  totalEmployees?: number;
  todayPresent?: number;
  todayLate?: number;
  attendanceRate?: number;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("daily");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [weekDate, setWeekDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch branches for filter
  useEffect(() => {
    async function fetchBranches() {
      try {
        const { data: response } = await apiClient.get("/branches", {
          params: { limit: 100 },
        });
        const brResult = response.data ?? response;
        setBranches(brResult.data ?? brResult ?? []);
      } catch {
        // silent
      }
    }
    fetchBranches();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const reportParams: Record<string, string> = {};
      if (branchFilter !== "ALL") reportParams.branchId = branchFilter;

      let reportEndpoint: string;
      if (activeTab === "daily") {
        reportEndpoint = "/reports/daily";
        reportParams.date = date;
      } else if (activeTab === "weekly") {
        reportEndpoint = "/reports/weekly";
        reportParams.weekOf = weekDate;
      } else if (activeTab === "monthly") {
        reportEndpoint = "/reports/monthly";
        const [y, m] = month.split("-");
        reportParams.month = String(parseInt(m, 10));
        reportParams.year = y;
      } else {
        reportEndpoint = "/reports/summary";
      }

      const statsParams: Record<string, string> = {};
      if (branchFilter !== "ALL") statsParams.branchId = branchFilter;

      const [reportRes, statsRes] = await Promise.allSettled([
        apiClient.get(reportEndpoint, { params: reportParams }),
        apiClient.get("/reports/summary", { params: statsParams }),
      ]);

      if (reportRes.status === "fulfilled") {
        const reportResult = reportRes.value.data.data ?? reportRes.value.data;
        setReportData(reportResult?.branches ?? reportResult?.data ?? reportResult ?? []);
      }
      if (statsRes.status === "fulfilled") {
        const statsResult = statsRes.value.data.data ?? statsRes.value.data;
        setStats(statsResult ?? null);
      }
    } catch {
      setReportData([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, branchFilter, date, weekDate, month]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {
        format: "xlsx",
      };
      if (branchFilter !== "ALL") params.branchId = branchFilter;
      if (activeTab === "daily") params.date = date;
      else if (activeTab === "weekly") params.weekOf = weekDate;
      else if (activeTab === "monthly") {
        const [y, m] = month.split("-");
        params.month = String(parseInt(m, 10));
        params.year = y;
      }

      const response = await apiClient.get("/reports/export", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report-${activeTab}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

  const statCards = [
    {
      title: "Total Employees",
      value: stats?.totalEmployees ?? 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Present",
      value: stats?.todayPresent ?? 0,
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Late",
      value: stats?.todayLate ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Attendance Rate",
      value: `${stats?.attendanceRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground">
            View attendance reports and export data
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" data-icon="inline-start" />
          Export
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) =>
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as string)}
      >
        <div className="flex flex-wrap items-end gap-3">
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* Branch filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Branch
            </label>
            <Select
              value={branchFilter}
              onValueChange={(v) => {
                if (v) setBranchFilter(v);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date pickers per tab */}
          {activeTab === "daily" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
          )}
          {activeTab === "weekly" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Week of
              </label>
              <Input
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
                className="w-40"
              />
            </div>
          )}
          {activeTab === "monthly" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Month
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-40"
              />
            </div>
          )}
        </div>

        {/* Daily tab content */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Report - {date}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ReportTable
                data={reportData}
                loading={loading}
                columns={[
                  { key: "branchName", label: "Branch" },
                  { key: "totalEmployees", label: "Employees" },
                  { key: "present", label: "Present" },
                  { key: "late", label: "Late" },
                  { key: "absent", label: "Absent" },
                  { key: "avgHours", label: "Avg Hours", format: "hours" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly tab content */}
        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Weekly Report - Week of {weekDate}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ReportTable
                data={reportData}
                loading={loading}
                columns={[
                  { key: "branchName", label: "Branch" },
                  { key: "totalEmployees", label: "Employees" },
                  { key: "present", label: "Present" },
                  { key: "late", label: "Late" },
                  { key: "absent", label: "Absent" },
                  { key: "avgHours", label: "Avg Hours", format: "hours" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly tab content */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Monthly Report - {month}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ReportTable
                data={reportData}
                loading={loading}
                columns={[
                  { key: "branchName", label: "Branch" },
                  { key: "totalEmployees", label: "Employees" },
                  { key: "present", label: "Present" },
                  { key: "late", label: "Late" },
                  { key: "absent", label: "Absent" },
                  { key: "avgHours", label: "Avg Hours", format: "hours" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary tab content */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary Report</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ReportTable
                data={reportData}
                loading={loading}
                columns={[
                  { key: "branchName", label: "Branch" },
                  { key: "totalEmployees", label: "Employees" },
                  { key: "present", label: "Present" },
                  { key: "late", label: "Late" },
                  { key: "absent", label: "Absent" },
                  { key: "avgHours", label: "Avg Hours", format: "hours" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Reusable report table component
interface Column {
  key: string;
  label: string;
  format?: "time" | "hours" | "percent";
}

function ReportTable({
  data,
  loading,
  columns,
}: {
  data: ReportRow[];
  loading: boolean;
  columns: Column[];
}) {
  function formatCell(value: unknown, format?: string): string {
    if (value === null || value === undefined) return "--";
    if (format === "time") {
      if (typeof value !== "string") return "--";
      try {
        return new Date(value).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return String(value);
      }
    }
    if (format === "hours") {
      return typeof value === "number" ? `${value.toFixed(1)}h` : "--";
    }
    if (format === "percent") {
      return typeof value === "number" ? `${value.toFixed(1)}%` : "--";
    }
    return String(value);
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-muted-foreground"
              >
                <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No report data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={row.id ?? i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {formatCell(row[col.key], col.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
