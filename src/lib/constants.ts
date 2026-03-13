import {
  Activity,
  BarChart2,
  BarChart3,
  Bell,
  Bot,
  BookOpenText,
  DollarSign,
  Download,
  Factory,
  LayoutDashboard,
  Package,
  Quote,
  Settings,
  ShieldCheck,
  Skull,
  Thermometer,
  Users,
  Wheat
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/types";

export const COLLECTIONS = {
  users: "users",
  batches: "batches",
  feedRecords: "feedRecords",
  growthRecords: "growthRecords",
  mortalityRecords: "mortalityRecords",
  livestockAdjustments: "livestockAdjustments",
  environmentReadings: "environmentReadings",
  marketPrices: "marketPrices",
  sales: "sales",
  expenses: "expenses",
  inventory: "inventory",
  workers: "workers",
  tasks: "tasks",
  quotations: "quotations",
  alerts: "alerts",
  notificationTokens: "notificationTokens",
  vaccinationSchedule: "vaccinationSchedule"
} as const;

export const SAFE_THRESHOLDS = {
  temperatureHigh: 33,
  temperatureLow: 25,
  humidityHigh: 70,
  humidityLow: 45,
  ammoniaHigh: 25,
  mortalityPercentDaily: 0.5,
  feedLowStockKg: 1000
};

export const DEFAULT_GROWOUT_DAYS = 40;
export const LIVESTOCK_INVENTORY_NAME = "Live Chickens";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  worker: "Worker"
};

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",        href: "/",                icon: LayoutDashboard, roles: ["admin", "manager", "worker"] },
  { label: "Batches",          href: "/batches",         icon: Factory,         roles: ["admin", "manager", "worker"] },
  { label: "Feed Management",  href: "/feed",            icon: Wheat,           roles: ["admin", "manager", "worker"] },
  { label: "Mortality",        href: "/mortality",       icon: Skull,           roles: ["admin", "manager", "worker"] },
  { label: "Market Prices",    href: "/market",          icon: Activity,        roles: ["admin", "manager"] },
  { label: "Environment",      href: "/environment",     icon: Thermometer,     roles: ["admin", "manager", "worker"] },
  { label: "Inventory",        href: "/inventory",       icon: Package,         roles: ["admin", "manager", "worker"] },
  { label: "Vaccinations",     href: "/vaccinations",    icon: ShieldCheck,     roles: ["admin", "manager", "worker"] },
  { label: "Batch Comparison", href: "/batch-comparison",icon: BarChart2,       roles: ["admin", "manager"] },
  { label: "Reports",          href: "/reports",         icon: BarChart3,       roles: ["admin", "manager"] },
  { label: "Sales",            href: "/sales",           icon: Activity,        roles: ["admin", "manager"] },
  { label: "Finance",          href: "/finance",         icon: DollarSign,      roles: ["admin", "manager"] },
  { label: "Quotations",       href: "/quotations",      icon: Quote,           roles: ["admin", "manager"] },
  { label: "Workers",          href: "/workers",         icon: Users,           roles: ["admin", "manager"] },
  { label: "AI Assistant",     href: "/ai-assistant",    icon: Bot,             roles: ["admin", "manager", "worker"] },
  { label: "Knowledge Center", href: "/knowledge-center",icon: BookOpenText,    roles: ["admin", "manager", "worker"] },
  { label: "Alerts",           href: "/alerts",          icon: Bell,            roles: ["admin", "manager", "worker"] },
  { label: "Users",            href: "/admin/users",     icon: Users,           roles: ["admin"] },
  { label: "Downloads",        href: "/downloads",       icon: Download,        roles: ["admin", "manager"] },
  { label: "Settings",         href: "/settings",        icon: Settings,        roles: ["admin", "manager", "worker"] }
];
