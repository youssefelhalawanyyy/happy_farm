import { NavLink } from "react-router-dom";
import { ChevronLeft, Menu, Sparkles } from "lucide-react";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { Mazra3tyLogo } from "@/components/brand/Mazra3tyLogo";

type SidebarSection = { title: string; hrefs: string[] };

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { title: "Operations", hrefs: ["/", "/batches", "/feed", "/market", "/environment", "/inventory", "/mortality"] },
  { title: "Health", hrefs: ["/vaccinations"] },
  { title: "Analytics", hrefs: ["/batch-comparison", "/reports", "/reports/exports"] },
  { title: "Business", hrefs: ["/sales", "/finance", "/quotations", "/workers"] },
  { title: "Intelligence", hrefs: ["/ai-assistant", "/knowledge-center", "/alerts"] },
  { title: "System", hrefs: ["/admin/users", "/downloads", "/settings"] }
];

export const Sidebar = () => {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { profile } = useAuth();

  const allowedItems = NAV_ITEMS.filter((item) => (profile ? item.roles.includes(profile.role) : false));
  const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: allowedItems.filter((item) => section.hrefs.includes(item.href))
  })).filter((section) => section.items.length > 0);
  const flatItems = sectionedItems.flatMap((section) => section.items);

  return (
    <aside
      className={cn(
        "sidebar-shell fixed inset-y-0 left-0 z-40 flex flex-col px-3 py-4 transition-all duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "w-[268px] translate-x-0" : "-translate-x-full lg:w-[72px] lg:translate-x-0"
      )}
    >
      {/* Logo Card */}
      <div className="sidebar-logo-card mb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Mazra3tyLogo variant="icon" className="shrink-0" />
            {sidebarOpen && (
              <div>
                <p className="text-[14px] font-semibold leading-tight text-slate-50">Mazra3ty</p>
                <p className="text-[11px] text-slate-400">Smart Farms Start Here</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 shrink-0 text-slate-400 hover:bg-white/10 hover:text-slate-200"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <Menu size={14} />}
          </Button>
        </div>

        {sidebarOpen && (
          <div className="sidebar-status-pill mt-2.5">
            <span className="sidebar-status-dot" />
            <Sparkles size={11} className="text-accent" />
            <span className="font-medium text-slate-200">Live farm monitoring active</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {sidebarOpen
          ? sectionedItems.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="sidebar-section-label">{section.title}</p>
                <div className="space-y-0.5">
                  {section.items.map((item, idx) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      style={{ animationDelay: `${idx * 28}ms` }}
                      className={({ isActive }) =>
                        cn("sidebar-nav-item", isActive ? "sidebar-nav-item-active" : "sidebar-nav-item-inactive")
                      }
                    >
                      <span className="sidebar-nav-icon">
                        <item.icon size={15} className="shrink-0" />
                      </span>
                      <span className="truncate text-[13px]">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))
          : flatItems.map((item, idx) => (
              <NavLink
                key={item.href}
                to={item.href}
                title={item.label}
                style={{ animationDelay: `${idx * 22}ms` }}
                className={({ isActive }) =>
                  cn("sidebar-nav-item mb-0.5 justify-center", isActive ? "sidebar-nav-item-active" : "sidebar-nav-item-inactive")
                }
              >
                <span className="sidebar-nav-icon">
                  <item.icon size={15} />
                </span>
              </NavLink>
            ))}
      </nav>

      {/* User card */}
      {profile && (
        <div className={cn("sidebar-user-card mt-3", !sidebarOpen && "px-1.5 py-2 text-center")}>
          {sidebarOpen ? (
            <>
              <p className="text-[13px] font-semibold text-white">{profile.displayName}</p>
              <p className="text-[11px] text-slate-400">{ROLE_LABELS[profile.role]}</p>
              {profile.assignedHouse && <p className="mt-0.5 text-[11px] text-slate-500">{profile.assignedHouse}</p>}
            </>
          ) : (
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {ROLE_LABELS[profile.role].slice(0, 3)}
            </p>
          )}
        </div>
      )}

      {/* Chick animation */}
      {sidebarOpen && (
        <div className="sidebar-chick-zone" aria-hidden="true">
          <div className="sidebar-chick-run">
            <span className="sidebar-chick-bob">🐥</span>
          </div>
          <div className="sidebar-chick-run sidebar-chick-run-delay">
            <span className="sidebar-chick-bob sidebar-chick-bob-delay">🐣</span>
          </div>
        </div>
      )}
    </aside>
  );
};
