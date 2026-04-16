"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAttendanceStore, type CheckInData } from "@/stores/attendance.store";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useDeviceFingerprint } from "@/hooks/use-device-fingerprint";
import { useWifi } from "@/hooks/use-wifi";
import {
  Clock,
  MapPin,
  Wifi,
  WifiOff,
  Fingerprint,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const moods = [
  { emoji: "\u{1F60A}", label: "Great", value: "GREAT" },
  { emoji: "\u{1F610}", label: "Okay", value: "OKAY" },
  { emoji: "\u{1F614}", label: "Sad", value: "SAD" },
  { emoji: "\u{1F624}", label: "Frustrated", value: "FRUSTRATED" },
  { emoji: "\u{1F912}", label: "Sick", value: "SICK" },
];

export default function AttendancePage() {
  const {
    todayAttendance,
    isCheckingIn,
    isCheckingOut,
    fetchToday,
    checkIn,
    checkOut,
  } = useAttendanceStore();

  const geo = useGeolocation();
  const device = useDeviceFingerprint();
  const wifi = useWifi();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fraudResult, setFraudResult] = useState<any>(null);
  const [loadingToday, setLoadingToday] = useState(true);

  useEffect(() => {
    fetchToday()
      .catch(() => {})
      .finally(() => setLoadingToday(false));
  }, [fetchToday]);

  const hasCheckedIn = !!todayAttendance?.checkInTime;
  const hasCheckedOut = !!todayAttendance?.checkOutTime;

  const buildPayload = useCallback((): CheckInData | null => {
    if (geo.latitude === null || geo.longitude === null) {
      setError("Waiting for GPS location. Please allow location access.");
      return null;
    }
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: geo.accuracy ?? 0,
      wifiSSID: wifi.ssid,
      wifiBSSID: wifi.bssid,
      deviceFingerprint: device.fingerprint,
      mockLocationDetected: geo.mockLocationDetected,
    };
  }, [geo, wifi, device]);

  async function handleCheckIn() {
    setError(null);
    const payload = buildPayload();
    if (!payload) return;

    try {
      const result = await checkIn(payload);
      setFraudResult(result?.fraudScore ?? null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Check-in failed. Please try again."
      );
    }
  }

  async function handleCheckOut() {
    setError(null);
    const payload = buildPayload();
    if (!payload) return;

    try {
      const result = await checkOut(payload);
      setFraudResult(result?.fraudScore ?? null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Check-out failed. Please try again."
      );
    }
  }

  function formatTime(dateStr: string | undefined | null): string {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getFraudColor(score: number): string {
    if (score <= 20) return "text-green-600 bg-green-50 border-green-200";
    if (score <= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (score <= 75) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  }

  if (loadingToday) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Main check-in/out card */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-6">
          {/* Current time display */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Status */}
          <div className="text-center">
            {!hasCheckedIn && (
              <p className="text-sm text-muted-foreground">
                You have not checked in yet
              </p>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <div className="space-y-1">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  Checked In
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Since {formatTime(todayAttendance?.checkInTime)}
                </p>
              </div>
            )}
            {hasCheckedOut && (
              <div className="space-y-1">
                <Badge variant="secondary">Checked Out</Badge>
                <p className="text-sm text-muted-foreground">
                  At {formatTime(todayAttendance?.checkOutTime)}
                </p>
              </div>
            )}
          </div>

          {/* Big action button */}
          {!hasCheckedOut && (
            <Button
              size="lg"
              onClick={hasCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={
                isCheckingIn ||
                isCheckingOut ||
                geo.isLoading ||
                geo.latitude === null
              }
              className={cn(
                "h-24 w-24 rounded-full text-lg font-bold shadow-lg transition-all",
                hasCheckedIn
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-green-500 hover:bg-green-600"
              )}
            >
              {isCheckingIn || isCheckingOut ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Clock className="h-8 w-8" />
              )}
            </Button>
          )}

          {!hasCheckedOut && (
            <p className="text-sm font-medium">
              {hasCheckedIn ? "Tap to Check Out" : "Tap to Check In"}
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Fraud score result */}
          {fraudResult !== null && fraudResult !== undefined && (
            <div
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-center",
                getFraudColor(fraudResult)
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Fraud Score: {fraudResult}/100
                </span>
              </div>
              <p className="mt-1 text-xs opacity-80">
                {fraudResult <= 20
                  ? "Verified - All clear"
                  : fraudResult <= 50
                  ? "Minor concerns detected"
                  : fraudResult <= 75
                  ? "Review recommended"
                  : "High risk - Manual review required"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mood selector */}
      {!hasCheckedOut && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              How are you feeling today?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2">
              {moods.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-all",
                    selectedMood === mood.value
                      ? "bg-primary/10 ring-2 ring-primary/30"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {mood.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Device Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* GPS */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">GPS Location</span>
            </div>
            {geo.isLoading ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Acquiring
              </Badge>
            ) : geo.error ? (
              <Badge
                variant="outline"
                className="gap-1 border-red-200 bg-red-50 text-red-600"
              >
                <XCircle className="h-3 w-3" />
                Error
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 border-green-200 bg-green-50 text-green-600"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={geo.refresh}
                  title="Refresh location"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {geo.mockLocationDetected && (
            <div className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              Mock location detected - this will be flagged
            </div>
          )}

          <Separator />

          {/* WiFi */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {wifi.isAvailable ? (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">WiFi Network</span>
            </div>
            {wifi.isAvailable ? (
              <Badge
                variant="outline"
                className="gap-1 border-green-200 bg-green-50 text-green-600"
              >
                <CheckCircle2 className="h-3 w-3" />
                {wifi.ssid ?? "Connected"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not available
              </Badge>
            )}
          </div>

          <Separator />

          {/* Device fingerprint */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Device ID</span>
            </div>
            <Badge
              variant="outline"
              className={
                device.fingerprint
                  ? "gap-1 border-green-200 bg-green-50 text-green-600"
                  : "text-muted-foreground"
              }
            >
              {device.fingerprint ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Registered
                </>
              ) : (
                "Loading..."
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Today's detail */}
      {todayAttendance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Today&apos;s Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Check In</p>
                <p className="text-lg font-semibold">
                  {formatTime(todayAttendance.checkInTime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check Out</p>
                <p className="text-lg font-semibold">
                  {formatTime(todayAttendance.checkOutTime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  variant="outline"
                  className={
                    todayAttendance.status === "ON_TIME"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : todayAttendance.status === "LATE"
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : ""
                  }
                >
                  {todayAttendance.status === "ON_TIME"
                    ? "On Time"
                    : todayAttendance.status === "LATE"
                    ? "Late"
                    : todayAttendance.status ?? "N/A"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <p className="text-lg font-semibold">
                  {todayAttendance.totalHours
                    ? `${todayAttendance.totalHours}h`
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
