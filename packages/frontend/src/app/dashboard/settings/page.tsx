"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "next-themes";
import {
  User,
  Lock,
  Bell,
  Sun,
  Moon,
  Info,
  Mail,
  Phone,
  Shield,
  Building2,
} from "lucide-react";

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

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();

  // Change password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Notification preferences
  const [pushEnabled, setPushEnabled] = useState(true);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password and confirmation do not match.",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.patch("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully.",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch {
      setPasswordMessage({
        type: "error",
        text: "Failed to change password. Please check your current password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user?.email ?? "--"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {(user as unknown as Record<string, string>)?.phone ?? "Not set"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {user ? getRoleBadge(user.role) : "--"}
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Branch ID: {user?.branchId ?? "Not assigned"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      currentPassword: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      newPassword: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      confirmPassword: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {passwordMessage && (
                <p
                  className={`text-sm ${
                    passwordMessage.type === "success"
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  }`}
                >
                  {passwordMessage.text}
                </p>
              )}

              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive push notifications for attendance reminders
                </p>
              </div>
              <Button
                variant={pushEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setPushEnabled(!pushEnabled)}
              >
                {pushEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Application</p>
                <p className="text-sm font-medium">Smart Attendance</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="text-sm font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Environment</p>
                <p className="text-sm font-medium">
                  {process.env.NODE_ENV === "production"
                    ? "Production"
                    : "Development"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
