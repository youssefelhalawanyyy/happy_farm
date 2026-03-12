import { NavLink } from "react-router-dom";
import { ChevronLeft, Menu, Sparkles } from "lucide-react";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { Mazra3tyLogo } from "@/components/brand/Mazra3tyLogo";

type SidebarSection = {
  title: string;
  hrefs: string[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: "Operations",
    hrefs: ["/", "/batches", "/feed", "/market", "/environment", "/inventory"]
  },
  {
    title: "Business",
    hrefs: ["/finance", "/quotations", "/workers"]
  },
  {
    title: "Intelligence",
    hrefs: ["/reports", "/ai-assistant", "/knowledge-center"]
  },
  {
    title: "System",
    hrefs: ["/settings"]
  }
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
        "sidebar-shell fixed inset-y-0 left-0 z-40 flex w-[292px] flex-col border-r border-white/10 px-4 py-5 text-slate-100 shadow-xl transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:w-[92px] lg:translate-x-0"
      )}
    >
      <div className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mazra3tyLogo variant="icon" className="shadow-[0_6px_16px_rgba(15,23,42,0.35)]" />
            {sidebarOpen ? (
              <div>
                <p className="text-base font-semibold text-slate-50">Mazra3ty</p>
                <p className="text-xs text-slate-300">Smart Farms Start Here</p>
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-slate-200 hover:bg-white/10"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={17} /> : <Menu size={17} />}
          </Button>
        </div>

        {sidebarOpen ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-2.5 py-2 text-xs text-slate-100">
            <span className="sidebar-status-dot" />
            <Sparkles size={13} className="text-accent" />
            <span className="font-medium">Live farm monitoring active</span>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto pr-1">
        {sidebarOpen
          ? sectionedItems.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400/90">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item, index) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "sidebar-nav-item group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          isActive
                            ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24),0_8px_18px_rgba(15,23,42,0.3)]"
                            : "text-slate-200/90 hover:bg-white/10 hover:text-white"
                        )
                      }
                      style={{ animationDelay: `${index * 32}ms` }}
                    >
                      <span className="sidebar-nav-icon">
                        <item.icon size={16} className="shrink-0" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))
          : flatItems.map((item, index) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "sidebar-nav-item group mb-1 flex justify-center rounded-xl px-2.5 py-2.5 transition",
                    isActive
                      ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24),0_8px_18px_rgba(15,23,42,0.3)]"
                      : "text-slate-200/90 hover:bg-white/10 hover:text-white"
                  )
                }
                style={{ animationDelay: `${index * 26}ms` }}
                title={item.label}
              >
                <span className="sidebar-nav-icon">
                  <item.icon size={16} className="shrink-0" />
                </span>
              </NavLink>
            ))}
      </nav>

      {profile ? (
        <div className={cn("mt-4 rounded-xl border border-white/15 bg-white/5 p-3", !sidebarOpen && "px-2 py-2")}>
          {sidebarOpen ? (
            <>
              <p className="text-sm font-semibold text-white">{profile.displayName}</p>
              <p className="text-xs text-slate-300">{ROLE_LABELS[profile.role]}</p>
              {profile.assignedHouse ? <p className="text-xs text-slate-400">{profile.assignedHouse}</p> : null}
            </>
          ) : (
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-300">{ROLE_LABELS[profile.role]}</p>
          )}
        </div>
      ) : null}

      {sidebarOpen ? (
        <div className="sidebar-chick-zone mt-3" aria-hidden="true">
          <div className="sidebar-chick-run">
            <span className="sidebar-chick-bob">🐥</span>
          </div>
          <div className="sidebar-chick-run sidebar-chick-run-delay">
            <span className="sidebar-chick-bob sidebar-chick-bob-delay">🐣</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
};
