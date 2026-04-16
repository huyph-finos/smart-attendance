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
  MapPin,
  Clock,
  Wifi,
  Plus,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";

interface WifiConfig {
  id: string;
  ssid: string;
  bssid: string;
  floor?: string | null;
}

interface BranchDetail {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number | null;
  workStartTime: string | null;
  workEndTime: string | null;
  lateThreshold: number | null;
  isActive?: boolean;
  _count?: { employees: number };
  wifiConfigs?: WifiConfig[];
}

interface BranchEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: { id: string; name: string } | null;
}

export default function BranchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const branchId = params.id as string;
  const { user } = useAuthStore();

  const isAdmin = user?.role === "ADMIN";

  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(true);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: "",
    workStartTime: "",
    workEndTime: "",
    lateThreshold: "",
  });

  // WiFi dialog state
  const [wifiOpen, setWifiOpen] = useState(false);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiForm, setWifiForm] = useState({
    ssid: "",
    bssid: "",
    floor: "",
  });

  const fetchBranch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: response } = await apiClient.get(`/branches/${branchId}`);
      const data = response.data ?? response;
      setBranch(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const { data: response } = await apiClient.get(
        `/branches/${branchId}/employees`,
        { params: { limit: 50 } }
      );
      const empResult = response.data ?? response;
      setEmployees(empResult.data ?? empResult ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchBranch();
    fetchEmployees();
  }, [fetchBranch, fetchEmployees]);

  const openEditDialog = () => {
    if (!branch) return;
    setEditForm({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      latitude: String(branch.latitude),
      longitude: String(branch.longitude),
      radius: branch.radius != null ? String(branch.radius) : "",
      workStartTime: branch.workStartTime ?? "",
      workEndTime: branch.workEndTime ?? "",
      lateThreshold:
        branch.lateThreshold != null ? String(branch.lateThreshold) : "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        code: editForm.code,
        address: editForm.address,
        latitude: parseFloat(editForm.latitude),
        longitude: parseFloat(editForm.longitude),
        radius: editForm.radius ? parseFloat(editForm.radius) : null,
        workStartTime: editForm.workStartTime || null,
        workEndTime: editForm.workEndTime || null,
        lateThreshold: editForm.lateThreshold
          ? parseInt(editForm.lateThreshold, 10)
          : null,
      };

      await apiClient.patch(`/branches/${branchId}`, payload);
      setEditOpen(false);
      fetchBranch();
    } catch {
      // silent
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    setWifiLoading(true);
    try {
      const payload: Record<string, string> = {
        ssid: wifiForm.ssid,
        bssid: wifiForm.bssid,
      };
      if (wifiForm.floor) payload.floor = wifiForm.floor;

      await apiClient.post(`/branches/${branchId}/wifi`, payload);
      setWifiOpen(false);
      setWifiForm({ ssid: "", bssid: "", floor: "" });
      fetchBranch();
    } catch {
      // silent
    } finally {
      setWifiLoading(false);
    }
  };

  const handleDeleteWifi = async (wifiId: string) => {
    if (!confirm("Delete this WiFi configuration?")) return;
    try {
      await apiClient.delete(`/branches/${branchId}/wifi/${wifiId}`);
      fetchBranch();
    } catch {
      // silent
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

  if (!branch) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/branches")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Branches
        </Button>
        <p className="text-muted-foreground">Branch not found.</p>
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
            onClick={() => router.push("/dashboard/branches")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{branch.name}</h2>
            <p className="text-sm text-muted-foreground">{branch.code}</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openEditDialog}>
            <Pencil className="h-4 w-4" data-icon="inline-start" />
            Edit Branch
          </Button>
        )}
      </div>

      {/* Branch Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm">{branch.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="text-sm">{branch.latitude}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="text-sm">{branch.longitude}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Radius</p>
              <p className="text-sm">
                {branch.radius != null ? `${branch.radius}m` : "Not set"}
              </p>
            </div>
            {/* Map placeholder */}
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/50">
              <div className="text-center text-sm text-muted-foreground">
                <MapPin className="mx-auto mb-1 h-6 w-6 opacity-50" />
                Map: {branch.latitude}, {branch.longitude}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Work Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Start Time</p>
                <p className="text-sm">{branch.workStartTime ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End Time</p>
                <p className="text-sm">{branch.workEndTime ?? "Not set"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Late Threshold</p>
              <p className="text-sm">
                {branch.lateThreshold != null
                  ? `${branch.lateThreshold} minutes`
                  : "Not set"}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
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
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Employees</p>
              <p className="text-sm font-medium">
                {branch._count?.employees ?? employees.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WiFi Configuration */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-4 w-4" />
            WiFi Configuration
          </CardTitle>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWifiOpen(true)}
            >
              <Plus className="h-4 w-4" data-icon="inline-start" />
              Add WiFi
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SSID</TableHead>
                <TableHead>BSSID</TableHead>
                <TableHead>Floor</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(branch.wifiConfigs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 4 : 3}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No WiFi access points configured
                  </TableCell>
                </TableRow>
              ) : (
                (branch.wifiConfigs ?? []).map((wifi) => (
                  <TableRow key={wifi.id}>
                    <TableCell className="font-medium">{wifi.ssid}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {wifi.bssid}
                    </TableCell>
                    <TableCell>{wifi.floor ?? "--"}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteWifi(wifi.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employees in this Branch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Employees in this Branch
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No employees in this branch
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
                    <TableCell>
                      <Badge variant="outline">{emp.role}</Badge>
                    </TableCell>
                    <TableCell>{emp.department?.name ?? "--"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Branch Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-code">Code</Label>
                <Input
                  id="edit-code"
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, code: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, address: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-lat">Latitude</Label>
                <Input
                  id="edit-lat"
                  type="number"
                  step="any"
                  value={editForm.latitude}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, latitude: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lng">Longitude</Label>
                <Input
                  id="edit-lng"
                  type="number"
                  step="any"
                  value={editForm.longitude}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, longitude: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-radius">Radius (m)</Label>
                <Input
                  id="edit-radius"
                  type="number"
                  value={editForm.radius}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, radius: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start">Start Time</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editForm.workStartTime}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      workStartTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-end">End Time</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editForm.workEndTime}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      workEndTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-late">Late Threshold</Label>
                <Input
                  id="edit-late"
                  type="number"
                  value={editForm.lateThreshold}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      lateThreshold: e.target.value,
                    }))
                  }
                />
              </div>
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

      {/* Add WiFi Dialog */}
      <Dialog open={wifiOpen} onOpenChange={setWifiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add WiFi Access Point</DialogTitle>
            <DialogDescription>
              Configure a WiFi access point for this branch
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddWifi} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wifi-ssid">SSID *</Label>
              <Input
                id="wifi-ssid"
                value={wifiForm.ssid}
                onChange={(e) =>
                  setWifiForm((p) => ({ ...p, ssid: e.target.value }))
                }
                placeholder="Office-WiFi"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wifi-bssid">BSSID *</Label>
              <Input
                id="wifi-bssid"
                value={wifiForm.bssid}
                onChange={(e) =>
                  setWifiForm((p) => ({ ...p, bssid: e.target.value }))
                }
                placeholder="AA:BB:CC:DD:EE:FF"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wifi-floor">Floor</Label>
              <Input
                id="wifi-floor"
                value={wifiForm.floor}
                onChange={(e) =>
                  setWifiForm((p) => ({ ...p, floor: e.target.value }))
                }
                placeholder="1st Floor"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWifiOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={wifiLoading}>
                {wifiLoading ? "Adding..." : "Add WiFi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
