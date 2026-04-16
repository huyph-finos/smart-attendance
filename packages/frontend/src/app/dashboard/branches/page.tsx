"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  workStartTime: string | null;
  workEndTime: string | null;
  employeeCount?: number;
  isActive?: boolean;
}

interface PaginatedResponse {
  data: Branch[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function BranchesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 10;

  const isAdmin = user?.role === "ADMIN";

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;

      const { data: response } = await apiClient.get("/branches", { params });
      const result: PaginatedResponse = response.data ?? response;
      setBranches(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this branch?")) return;
    try {
      await apiClient.delete(`/branches/${id}`);
      fetchBranches();
    } catch {
      // silent
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Branches</h2>
          <p className="text-sm text-muted-foreground">
            Manage company branches and locations
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => router.push("/dashboard/branches/create")}>
            <Plus className="h-4 w-4" data-icon="inline-start" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search branches..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-8"
            />
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
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                ) : branches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 7 : 6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No branches found
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => (
                    <TableRow
                      key={branch.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/branches/${branch.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {branch.name}
                      </TableCell>
                      <TableCell>{branch.code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {branch.address}
                      </TableCell>
                      <TableCell>
                        {branch.workStartTime && branch.workEndTime
                          ? `${branch.workStartTime} - ${branch.workEndTime}`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        {branch.employeeCount ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            branch.isActive !== false
                              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                          }
                        >
                          {branch.isActive !== false ? "Active" : "Inactive"}
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
                                  `/dashboard/branches/${branch.id}`
                                );
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => handleDelete(branch.id, e)}
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
