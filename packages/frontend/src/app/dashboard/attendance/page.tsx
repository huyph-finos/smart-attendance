"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAttendanceStore, type CheckInData } from "@/stores/attendance.store";
import { useAuthStore } from "@/stores/auth.store";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useDeviceFingerprint } from "@/hooks/use-device-fingerprint";
import { useWifi } from "@/hooks/use-wifi";
import apiClient from "@/lib/api-client";
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
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const moods = [
  { emoji: "\uD83D\uDE0A", label: "Great", value: "GREAT", bg: "bg-green-50 dark:bg-green-950", ring: "ring-green-400", text: "text-green-700 dark:text-green-400" },
  { emoji: "\uD83D\uDE10", label: "Okay", value: "OKAY", bg: "bg-blue-50 dark:bg-blue-950", ring: "ring-blue-400", text: "text-blue-700 dark:text-blue-400" },
  { emoji: "\uD83D\uDE14", label: "Sad", value: "SAD", bg: "bg-purple-50 dark:bg-purple-950", ring: "ring-purple-400", text: "text-purple-700 dark:text-purple-400" },
  { emoji: "\uD83D\uDE24", label: "Frustrated", value: "FRUSTRATED", bg: "bg-orange-50 dark:bg-orange-950", ring: "ring-orange-400", text: "text-orange-700 dark:text-orange-400" },
  { emoji: "\uD83E\uDD12", label: "Sick", value: "SICK", bg: "bg-red-50 dark:bg-red-950", ring: "ring-red-400", text: "text-red-700 dark:text-red-400" },
];

const vietnameseDays = [
  "Chu Nhat", "Thu Hai", "Thu Ba", "Thu Tu", "Thu Nam", "Thu Sau", "Thu Bay",
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

  const { user } = useAuthStore();
  const geo = useGeolocation();
  const device = useDeviceFingerprint();
  const wifi = useWifi();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fraudResult, setFraudResult] = useState<any>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickStats, setQuickStats] = useState<{
    totalEmployees: number;
    checkedInToday: number;
    branchName?: string;
  } | null>(null);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchToday()
      .catch(() => {})
      .finally(() => setLoadingToday(false));
  }, [fetchToday]);

  // Quick stats for managers/admins
  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  useEffect(() => {
    if (!isAdminOrManager) return;
    apiClient
      .get("/dashboard/overview")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setQuickStats({
          totalEmployees: data.totalEmployees ?? 0,
          checkedInToday: data.checkedInToday ?? 0,
          branchName: data.branchName,
        });
      })
      .catch(() => {});
  }, [isAdminOrManager]);

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

  const timeString = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dayOfWeek = vietnameseDays[currentTime.getDay()];
  const dateString = `${dayOfWeek}, ${String(currentTime.getDate()).padStart(2, "0")}/${String(currentTime.getMonth() + 1).padStart(2, "0")}/${currentTime.getFullYear()}`;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Quick Stats Banner for Managers/Admins */}
      {isAdminOrManager && quickStats && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-950">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Hom nay:{" "}
            <span className="font-semibold">
              {quickStats.checkedInToday}/{quickStats.totalEmployees}
            </span>{" "}
            nhan vien da cham cong
            {quickStats.branchName ? ` tai ${quickStats.branchName}` : ""}
          </p>
        </div>
      )}

      {/* Real-time Clock Widget */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-1 p-6 pb-4">
          <p className="font-mono text-5xl font-bold tracking-wider tabular-nums">
            {timeString}
          </p>
          <p className="text-sm text-muted-foreground">
            {dateString}
          </p>
        </CardContent>
      </Card>

      {/* Main check-in/out card */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-6">

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
                  {(() => {
                    const moodValue = todayAttendance?.mood ?? selectedMood;
                    const moodItem = moods.find((m) => m.value === moodValue);
                    return moodItem ? ` ${moodItem.emoji}` : "";
                  })()}
                </p>
              </div>
            )}
            {hasCheckedOut && (
              <div className="space-y-1">
                <Badge variant="secondary">Checked Out</Badge>
                <p className="text-sm text-muted-foreground">
                  At {formatTime(todayAttendance?.checkOutTime)}
                  {(() => {
                    const moodValue = todayAttendance?.mood ?? selectedMood;
                    const moodItem = moods.find((m) => m.value === moodValue);
                    return moodItem ? ` ${moodItem.emoji}` : "";
                  })()}
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
              Ban cam thay the nao hom nay?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2">
              {moods.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-all duration-200",
                    selectedMood === mood.value
                      ? `${mood.bg} ring-2 ${mood.ring} scale-110 shadow-md`
                      : "hover:bg-muted hover:scale-105"
                  )}
                >
                  <span className={cn(
                    "text-3xl transition-transform duration-200",
                    selectedMood === mood.value && "animate-bounce"
                  )}>
                    {mood.emoji}
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    selectedMood === mood.value
                      ? mood.text
                      : "text-muted-foreground"
                  )}>
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
            {/* Mood display */}
            {(todayAttendance.mood || selectedMood) && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Tam trang:</span>
                  {(() => {
                    const moodValue = todayAttendance.mood ?? selectedMood;
                    const moodItem = moods.find((m) => m.value === moodValue);
                    if (!moodItem) return null;
                    return (
                      <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", moodItem.bg, moodItem.text)}>
                        <span className="text-base">{moodItem.emoji}</span>
                        {moodItem.label}
                      </span>
                    );
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
