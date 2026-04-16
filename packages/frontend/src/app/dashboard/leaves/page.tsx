"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Check,
} from "lucide-react";

interface Leave {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt?: string;
}

interface PaginatedResponse {
  data: Leave[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual" },
  { value: "SICK", label: "Sick" },
  { value: "PERSONAL", label: "Personal" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "OTHER", label: "Other" },
];

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: "Pending",
      className:
        "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
    },
    APPROVED: {
      label: "Approved",
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
    },
    REJECTED: {
      label: "Rejected",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    },
  };
  const info = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}

function getTypeBadge(type: string) {
  const found = LEAVE_TYPES.find((t) => t.value === type);
  return (
    <Badge variant="secondary">{found?.label ?? type}</Badge>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, diff + 1);
}

export default function LeavesPage() {
  const { user } = useAuthStore();
  const isManagerOrAdmin =
    user?.role === "ADMIN" || user?.role === "MANAGER";

  const [activeTab, setActiveTab] = useState("my-leaves");

  // My Leaves state
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Pending Approvals state
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);

  // Request Leave dialog
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestForm, setRequestForm] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const fetchMyLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const { data: response } = await apiClient.get("/leaves", {
        params: { page, limit },
      });
      const result: PaginatedResponse = response.data;
      setLeaves(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch {
      setLeaves([]);
    } finally {
      setLeavesLoading(false);
    }
  }, [page]);

  const fetchPendingLeaves = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    setPendingLoading(true);
    try {
      const { data: response } = await apiClient.get("/leaves/pending", {
        params: { page: pendingPage, limit },
      });
      const result: PaginatedResponse = response.data;
      setPendingLeaves(result.data ?? []);
      setPendingTotal(result.meta?.total ?? 0);
    } catch {
      setPendingLeaves([]);
    } finally {
      setPendingLoading(false);
    }
  }, [isManagerOrAdmin, pendingPage]);

  useEffect(() => {
    fetchMyLeaves();
  }, [fetchMyLeaves]);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingLeaves();
    }
  }, [activeTab, fetchPendingLeaves]);

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const payload: Record<string, string> = {
        type: requestForm.type,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
      };
      if (requestForm.reason.trim()) {
        payload.reason = requestForm.reason.trim();
      }
      await apiClient.post("/leaves", payload);
      setRequestOpen(false);
      setRequestForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      fetchMyLeaves();
    } catch {
      // silent
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      await apiClient.delete(`/leaves/${id}`);
      fetchMyLeaves();
    } catch {
      // silent
    }
  };

  const handleApproveReject = async (id: string, isApproved: boolean) => {
    try {
      await apiClient.patch(`/leaves/${id}/approve`, { isApproved });
      fetchPendingLeaves();
    } catch {
      // silent
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Leave Management</h2>
          <p className="text-sm text-muted-foreground">
            Request and manage your leaves
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="h-4 w-4" data-icon="inline-start" />
          Request Leave
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as string)}
      >
        <TabsList>
          <TabsTrigger value="my-leaves">
            <CalendarDays className="h-4 w-4" data-icon="inline-start" />
            My Leaves
          </TabsTrigger>
          {isManagerOrAdmin && (
            <TabsTrigger value="pending">
              <Check className="h-4 w-4" data-icon="inline-start" />
              Pending Approvals
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Leaves Tab */}
        <TabsContent value="my-leaves">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavesLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : leaves.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-12 text-center text-muted-foreground"
                        >
                          <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-50" />
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaves.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell>{getTypeBadge(leave.type)}</TableCell>
                          <TableCell className="text-sm">
                            {formatDate(leave.startDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(leave.endDate)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {calcDays(leave.startDate, leave.endDate)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {leave.reason || "--"}
                          </TableCell>
                          <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          <TableCell className="text-right">
                            {leave.status === "PENDING" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelLeave(leave.id)}
                              >
                                <X className="h-4 w-4 text-destructive" />
                                Cancel
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
              {!leavesLoading && total > 0 && (
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
        </TabsContent>

        {/* Pending Approvals Tab */}
        {isManagerOrAdmin && (
          <TabsContent value="pending">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start - End Date</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : pendingLeaves.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-12 text-center text-muted-foreground"
                          >
                            <Check className="mx-auto mb-2 h-8 w-8 opacity-50" />
                            No pending approvals
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingLeaves.map((leave) => (
                          <TableRow key={leave.id}>
                            <TableCell className="font-medium text-sm">
                              {leave.user
                                ? `${leave.user.firstName} ${leave.user.lastName}`
                                : "--"}
                            </TableCell>
                            <TableCell>{getTypeBadge(leave.type)}</TableCell>
                            <TableCell className="text-sm">
                              {formatDate(leave.startDate)} -{" "}
                              {formatDate(leave.endDate)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {calcDays(leave.startDate, leave.endDate)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              {leave.reason || "--"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() =>
                                    handleApproveReject(leave.id, true)
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    handleApproveReject(leave.id, false)
                                  }
                                >
                                  <X className="h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {!pendingLoading && pendingTotal > 0 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {(pendingPage - 1) * limit + 1}-
                      {Math.min(pendingPage * limit, pendingTotal)} of{" "}
                      {pendingTotal}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        disabled={pendingPage <= 1}
                        onClick={() => setPendingPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 text-sm">
                        {pendingPage} / {pendingTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        disabled={pendingPage >= pendingTotalPages}
                        onClick={() => setPendingPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Request Leave Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request for approval
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestLeave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select
                value={requestForm.type}
                onValueChange={(v) => {
                  if (v)
                    setRequestForm((p) => ({ ...p, type: v as string }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={requestForm.startDate}
                  onChange={(e) =>
                    setRequestForm((p) => ({
                      ...p,
                      startDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={requestForm.endDate}
                  onChange={(e) =>
                    setRequestForm((p) => ({
                      ...p,
                      endDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                rows={3}
                value={requestForm.reason}
                onChange={(e) =>
                  setRequestForm((p) => ({ ...p, reason: e.target.value }))
                }
                placeholder="Enter reason for leave..."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={requestLoading}>
                {requestLoading ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
