import { useMemo } from "react";
import { Bell, Building2, Cpu, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export const SettingsPage = () => {
  const { profile } = useAuth();

  const settingsStatus = useMemo(
    () => [
      {
        title: "Company Profile",
        description: "Branding and quotation identity are configured and active.",
        icon: Building2,
        status: "Configured"
      },
      {
        title: "Role & Access",
        description: "Permissions are controlled by Firestore rules and admin role assignment.",
        icon: ShieldCheck,
        status: profile?.role === "admin" ? "Admin Access" : "Restricted Access"
      },
      {
        title: "Notifications",
        description: "Foreground and background push notifications are enabled where supported.",
        icon: Bell,
        status: "Enabled"
      },
      {
        title: "ESP32 Environment Ingestion",
        description: "Environment page tracks live readings and displays offline state when no telemetry arrives.",
        icon: Cpu,
        status: "Monitoring"
      }
    ],
    [profile?.role]
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="System Settings"
        description="Central configuration dashboard for operations, integrations, and access control."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {settingsStatus.map((entry) => (
          <Card key={entry.title} className="h-full">
            <CardHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <entry.icon size={18} />
              </div>
              <CardTitle>{entry.title}</CardTitle>
              <CardDescription>{entry.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="muted">{entry.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
