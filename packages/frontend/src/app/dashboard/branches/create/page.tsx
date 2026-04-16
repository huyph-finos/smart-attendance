"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { ArrowLeft } from "lucide-react";

export default function CreateBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
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

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        code: form.code,
        address: form.address,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      };
      if (form.radius) payload.radius = parseFloat(form.radius);
      if (form.workStartTime) payload.workStartTime = form.workStartTime;
      if (form.workEndTime) payload.workEndTime = form.workEndTime;
      if (form.lateThreshold)
        payload.lateThreshold = parseInt(form.lateThreshold, 10);

      const { data: response } = await apiClient.post("/branches", payload);
      const branchId = response.data?.id;
      router.push(
        branchId ? `/dashboard/branches/${branchId}` : "/dashboard/branches"
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create branch";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/dashboard/branches")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Create Branch</h2>
          <p className="text-sm text-muted-foreground">
            Add a new branch location
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Branch Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Main Office"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  placeholder="HQ-01"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="123 Main Street, City"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => updateField("latitude", e.target.value)}
                  placeholder="10.762622"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => updateField("longitude", e.target.value)}
                  placeholder="106.660172"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="radius">Radius (m)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={form.radius}
                  onChange={(e) => updateField("radius", e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="workStartTime">Work Start Time</Label>
                <Input
                  id="workStartTime"
                  type="time"
                  value={form.workStartTime}
                  onChange={(e) => updateField("workStartTime", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workEndTime">Work End Time</Label>
                <Input
                  id="workEndTime"
                  type="time"
                  value={form.workEndTime}
                  onChange={(e) => updateField("workEndTime", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lateThreshold">Late Threshold (min)</Label>
                <Input
                  id="lateThreshold"
                  type="number"
                  value={form.lateThreshold}
                  onChange={(e) => updateField("lateThreshold", e.target.value)}
                  placeholder="15"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/branches")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Branch"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
