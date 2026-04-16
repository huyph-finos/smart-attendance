"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Shield,
  Pencil,
  Calendar,
} from "lucide-react";

interface EmployeeDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  isActive?: boolean;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  createdAt?: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
}

function getRoleBadge(role: string) {
  const map: Record<string, { label: string; className: string }> = {
    ADMIN: {
      label: "Admin",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    },
    MANAGER: {
      label: "Manager",
      className:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
    },
    EMPLOYEE: {
      label: "Employee",
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
    },
  };
  const info = map[role] ?? { label: role, className: "" };
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    ON_TIME: {
      label: "On Time",
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
    },
    LATE: {
      label: "Late",
      className:
        "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
    },
    ABSENT: {
      label: "Absent",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    },
    ON_LEAVE: {
      label: "On Leave",
      className:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
    },
  };
  const info = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const { user } = useAuthStore();

  const isAdmin = user?.role === "ADMIN";

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    role: "",
  });

  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const { data: response } = await apiClient.get(`/users/${employeeId}`);
      setEmployee(response.data ?? response);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const fetchAttendance = useCallback(async () => {
    try {
      const dateTo = new Date().toISOString().split("T")[0];
      const dateFrom = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .split("T")[0];
      const { data: response } = await apiClient.get("/attendance/history", {
        params: { userId: employeeId, dateFrom, dateTo, limit: 7 },
      });
      const attResult = response.data ?? response;
      setAttendance(attResult.data ?? attResult ?? []);
    } catch {
      setAttendance([]);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmployee();
    fetchAttendance();
  }, [fetchEmployee, fetchAttendance]);

  const openEditDialog = () => {
    if (!employee) return;
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? "",
      role: employee.role,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        role: editForm.role,
      };
      if (editForm.phone) payload.phone = editForm.phone;

      await apiClient.patch(`/users/${employeeId}`, payload);
      setEditOpen(false);
      fetchEmployee();
    } catch {
      // silent
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/employees")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Employees
        </Button>
        <p className="text-muted-foreground">Employee not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/dashboard/employees")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openEditDialog}>
            <Pencil className="h-4 w-4" data-icon="inline-start" />
            Edit
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{employee.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {getRoleBadge(employee.role)}
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {employee.branch?.name ?? "No branch assigned"}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="text-sm">
                {employee.department?.name ?? "No department"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                variant="outline"
                className={
                  employee.isActive !== false
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                }
              >
                {employee.isActive !== false ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Recent Attendance (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No attendance records
                    </TableCell>
                  </TableRow>
                ) : (
                  attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs">
                        {formatDate(record.date)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatTime(record.checkInTime)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatTime(record.checkOutTime)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-fn">First Name</Label>
                <Input
                  id="edit-fn"
                  value={editForm.firstName}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-ln">Last Name</Label>
                <Input
                  id="edit-ln"
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, lastName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => {
                  if (v) setEditForm((p) => ({ ...p, role: v }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
