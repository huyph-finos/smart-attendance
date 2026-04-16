"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  isActive?: boolean;
}

interface BranchOption {
  id: string;
  name: string;
}

const roleOptions = [
  { label: "All Roles", value: "ALL" },
  { label: "Admin", value: "ADMIN" },
  { label: "Manager", value: "MANAGER" },
  { label: "Employee", value: "EMPLOYEE" },
];

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

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const limit = 10;

  const isAdmin = user?.role === "ADMIN";

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

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (roleFilter !== "ALL") params.role = roleFilter;
      if (branchFilter !== "ALL") params.branchId = branchFilter;

      const { data: response } = await apiClient.get("/users", { params });
      const result = response.data ?? response;
      setEmployees(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, branchFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      await apiClient.delete(`/users/${id}`);
      fetchEmployees();
    } catch {
      // silent
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Manage employees and their information
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => router.push("/dashboard/employees/create")}>
            <Plus className="h-4 w-4" data-icon="inline-start" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                if (v) setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Branch
            </label>
            <Select
              value={branchFilter}
              onValueChange={(v) => {
                if (v) setBranchFilter(v);
                setPage(1);
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
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: isAdmin ? 7 : 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 7 : 6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/employees/${emp.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {emp.firstName} {emp.lastName}
                      </TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{getRoleBadge(emp.role)}</TableCell>
                      <TableCell>{emp.branch?.name ?? "--"}</TableCell>
                      <TableCell>{emp.department?.name ?? "--"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            emp.isActive !== false
                              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                          }
                        >
                          {emp.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/dashboard/employees/${emp.id}`
                                );
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => handleDelete(emp.id, e)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
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
    </div>
  );
}
