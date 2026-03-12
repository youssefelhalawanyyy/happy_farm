import { Bell, LogOut, MoonStar, Search, SunMedium } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { COLLECTIONS } from "@/lib/constants";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import type { Alert } from "@/types";

export const Topbar = () => {
  const { darkMode, toggleDarkMode } = useAppStore();
  const { logout } = useAuth();
  const { data: alerts } = useRealtimeCollection<Alert>(COLLECTIONS.alerts);
  const unreadAlerts = alerts.filter((entry) => !entry.read).length;

  return (
    <header className="topbar-shell sticky top-0 z-20 mb-5 flex items-center justify-between gap-4 rounded-2xl p-3 backdrop-blur">
      <div className="hidden min-w-[220px] lg:block">
        <p className="dashboard-title-font text-sm font-semibold">Mazra3ty Command Center</p>
        <p className="text-xs text-muted-foreground">Smart Farms Start Here</p>
      </div>

      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
        <Input placeholder="Search module, batch, worker..." className="pl-9" />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
          {darkMode ? <SunMedium size={16} /> : <MoonStar size={16} />}
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell size={16} />
          {unreadAlerts > 0 ? (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadAlerts}
            </span>
          ) : null}
        </Button>

        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut size={14} className="mr-1" />
          Sign out
        </Button>
      </div>
    </header>
  );
};
