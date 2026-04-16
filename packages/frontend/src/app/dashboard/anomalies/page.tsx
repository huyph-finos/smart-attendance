"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import {
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";

interface Anomaly {
  id: string;
  type: string;
  severity: string;
  description: string;
  isResolved: boolean;
  resolvedNote?: string;
  attendance?: {
    date?: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  createdAt?: string;
}

interface PaginatedResponse {
  data: Anomaly[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AnomalyStats {
  total: number;
  unresolved: number;
  critical: number;
  high: number;
}

function getSeverityBadge(severity: string) {
  const map: Record<string, { label: string; className: string }> = {
    LOW: {
      label: "Low",
      className:
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400",
    },
    MEDIUM: {
      label: "Medium",
      className:
        "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
    },
    HIGH: {
      label: "High",
      className:
        "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
    },
    CRITICAL: {
      label: "Critical",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    },
  };
  const info = map[severity] ?? { label: severity, className: "" };
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}

function getTypeBadge(type: string) {
  const label = type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant="secondary">{label}</Badge>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AnomaliesPage() {
  const { user } = useAuthStore();
  const isManagerOrAdmin =
    user?.role === "ADMIN" || user?.role === "MANAGER";

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [resolvedFilter, setResolvedFilter] = useState<string>("ALL");

  // Stats
  const [stats, setStats] = useState<AnomalyStats>({
    total: 0,
    unresolved: 0,
    critical: 0,
    high: 0,
  });

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string>("");
  const [resolvedNote, setResolvedNote] = useState("");
  const [resolveLoading, setResolveLoading] = useState(false);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (severityFilter !== "ALL") params.severity = severityFilter;
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (resolvedFilter === "UNRESOLVED") params.isResolved = "false" as unknown as string;
      if (resolvedFilter === "RESOLVED") params.isResolved = "true" as unknown as string;

      const { data: response } = await apiClient.get("/anomalies", { params });
      const result: PaginatedResponse = response.data ?? response;
      setAnomalies(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch {
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, typeFilter, resolvedFilter]);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch all to compute stats, or use a dedicated endpoint if available
      const [allRes, unresolvedRes, criticalRes, highRes] = await Promise.all([
        apiClient.get("/anomalies", { params: { limit: 1 } }),
        apiClient.get("/anomalies", { params: { limit: 1, isResolved: "false" } }),
        apiClient.get("/anomalies", {
          params: { limit: 1, severity: "CRITICAL" },
        }),
        apiClient.get("/anomalies", {
          params: { limit: 1, severity: "HIGH" },
        }),
      ]);
      const allResult = allRes.data.data ?? allRes.data;
      const unresolvedResult = unresolvedRes.data.data ?? unresolvedRes.data;
      const criticalResult = criticalRes.data.data ?? criticalRes.data;
      const highResult = highRes.data.data ?? highRes.data;
      setStats({
        total: allResult?.meta?.total ?? 0,
        unresolved: unresolvedResult?.meta?.total ?? 0,
        critical: criticalResult?.meta?.total ?? 0,
        high: highResult?.meta?.total ?? 0,
      });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolveLoading(true);
    try {
      await apiClient.patch(`/anomalies/${resolveId}/resolve`, {
        resolvedNote: resolvedNote.trim(),
      });
      setResolveOpen(false);
      setResolvedNote("");
      setResolveId("");
      fetchAnomalies();
      fetchStats();
    } catch {
      // silent
    } finally {
      setResolveLoading(false);
    }
  };

  const openResolveDialog = (id: string) => {
    setResolveId(id);
    setResolvedNote("");
    setResolveOpen(true);
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!isManagerOrAdmin) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Anomalies</h2>
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Anomalies</h2>
        <p className="text-sm text-muted-foreground">
          Monitor and resolve attendance anomalies
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Anomalies</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-950">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unresolved</p>
              <p className="text-xl font-bold">{stats.unresolved}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Critical</p>
              <p className="text-xl font-bold">{stats.critical}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950">
              <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">High</p>
              <p className="text-xl font-bold">{stats.high}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Severity
            </label>
            <Select
              value={severityFilter}
              onValueChange={(v) => {
                if (v) {
                  setSeverityFilter(v as string);
                  handleFilterChange();
                }
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                if (v) {
                  setTypeFilter(v as string);
                  handleFilterChange();
                }
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="LATE_CHECK_IN">Late Check-in</SelectItem>
                <SelectItem value="EARLY_CHECK_OUT">Early Check-out</SelectItem>
                <SelectItem value="MISSED_CHECK_IN">Missed Check-in</SelectItem>
                <SelectItem value="MISSED_CHECK_OUT">Missed Check-out</SelectItem>
                <SelectItem value="LOCATION_MISMATCH">Location Mismatch</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={resolvedFilter}
              onValueChange={(v) => {
                if (v) {
                  setResolvedFilter(v as string);
                  handleFilterChange();
                }
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : anomalies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No anomalies found
                    </TableCell>
                  </TableRow>
                ) : (
                  anomalies.map((anomaly) => (
                    <TableRow key={anomaly.id}>
                      <TableCell className="text-sm">
                        {formatDate(anomaly.attendance?.date || anomaly.createdAt || "")}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {anomaly.attendance?.user
                          ? `${anomaly.attendance.user.firstName} ${anomaly.attendance.user.lastName}`
                          : "--"}
                      </TableCell>
                      <TableCell>{getTypeBadge(anomaly.type)}</TableCell>
                      <TableCell>
                        {getSeverityBadge(anomaly.severity)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {anomaly.description || "--"}
                      </TableCell>
                      <TableCell>
                        {anomaly.isResolved ? (
                          <Badge
                            variant="outline"
                            className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Unresolved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!anomaly.isResolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResolveDialog(anomaly.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}-
                {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Anomaly</DialogTitle>
            <DialogDescription>
              Provide a note explaining the resolution
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResolve} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resolved-note">Resolution Note</Label>
              <Textarea
                id="resolved-note"
                rows={4}
                value={resolvedNote}
                onChange={(e) => setResolvedNote(e.target.value)}
                placeholder="Describe how this anomaly was resolved..."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResolveOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resolveLoading}>
                {resolveLoading ? "Resolving..." : "Mark as Resolved"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
