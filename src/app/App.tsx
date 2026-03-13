import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

const LoginPage = lazy(async () => ({ default: (await import("@/pages/LoginPage")).LoginPage }));
const DashboardPage = lazy(async () => ({ default: (await import("@/pages/DashboardPage")).DashboardPage }));
const BatchesPage = lazy(async () => ({ default: (await import("@/pages/BatchesPage")).BatchesPage }));
const FeedPage = lazy(async () => ({ default: (await import("@/pages/FeedPage")).FeedPage }));
const MortalityPage = lazy(async () => ({ default: (await import("@/pages/MortalityPage")).MortalityPage }));
const EnvironmentPage = lazy(async () => ({ default: (await import("@/pages/EnvironmentPage")).EnvironmentPage }));
const MarketPage = lazy(async () => ({ default: (await import("@/pages/MarketPage")).MarketPage }));
const SalesPage = lazy(async () => ({ default: (await import("@/pages/SalesPage")).SalesPage }));
const FinancePage = lazy(async () => ({ default: (await import("@/pages/FinancePage")).FinancePage }));
const QuotationsPage = lazy(async () => ({ default: (await import("@/pages/QuotationsPage")).QuotationsPage }));
const InventoryPage = lazy(async () => ({ default: (await import("@/pages/InventoryPage")).InventoryPage }));
const WorkersPage = lazy(async () => ({ default: (await import("@/pages/WorkersPage")).WorkersPage }));
const AlertsPage = lazy(async () => ({ default: (await import("@/pages/AlertsPage")).AlertsPage }));
const ReportsPage = lazy(async () => ({ default: (await import("@/pages/ReportsPage")).ReportsPage }));
const ReportsExportsPage = lazy(async () => ({ default: (await import("@/pages/ReportsExportsPage")).ReportsExportsPage }));
const AdminUsersPage = lazy(async () => ({ default: (await import("@/pages/AdminUsersPage")).AdminUsersPage }));
const DownloadsPage = lazy(async () => ({ default: (await import("@/pages/DownloadsPage")).DownloadsPage }));
const SettingsPage = lazy(async () => ({ default: (await import("@/pages/SettingsPage")).SettingsPage }));
const KnowledgeCenterPage = lazy(async () => ({ default: (await import("@/pages/KnowledgeCenterPage")).KnowledgeCenterPage }));
const AIAssistantPage = lazy(async () => ({ default: (await import("@/pages/AIAssistantPage")).AIAssistantPage }));
const VaccinationPage = lazy(async () => ({ default: (await import("@/pages/VaccinationPage")).VaccinationPage }));
const BatchComparisonPage = lazy(async () => ({ default: (await import("@/pages/BatchComparisonPage")).BatchComparisonPage }));

const RouteFallback = () => (
  <div className="grid min-h-[45vh] place-items-center rounded-2xl border border-border/70 bg-card/40 text-sm text-muted-foreground">
    Loading module...
  </div>
);

const withSuspense = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>;

export const App = () => (
  <Routes>
    <Route path="/login" element={withSuspense(<LoginPage />)} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={withSuspense(<DashboardPage />)} />
        <Route path="/batches" element={withSuspense(<BatchesPage />)} />
        <Route path="/feed" element={withSuspense(<FeedPage />)} />
        <Route path="/mortality" element={withSuspense(<MortalityPage />)} />
        <Route path="/environment" element={withSuspense(<EnvironmentPage />)} />
        <Route path="/market" element={withSuspense(<MarketPage />)} />
        <Route path="/sales" element={withSuspense(<SalesPage />)} />
        <Route path="/finance" element={withSuspense(<FinancePage />)} />
        <Route path="/quotations" element={withSuspense(<QuotationsPage />)} />
        <Route path="/inventory" element={withSuspense(<InventoryPage />)} />
        <Route path="/workers" element={withSuspense(<WorkersPage />)} />
        <Route path="/alerts" element={withSuspense(<AlertsPage />)} />
        <Route path="/reports" element={withSuspense(<ReportsPage />)} />
        <Route path="/ai-assistant" element={withSuspense(<AIAssistantPage />)} />
        <Route path="/knowledge-center" element={withSuspense(<KnowledgeCenterPage />)} />
        <Route path="/reports/exports" element={withSuspense(<ReportsExportsPage />)} />
        <Route path="/downloads" element={withSuspense(<DownloadsPage />)} />
        <Route path="/settings" element={withSuspense(<SettingsPage />)} />
        <Route path="/vaccinations" element={withSuspense(<VaccinationPage />)} />
        <Route path="/batch-comparison" element={withSuspense(<BatchComparisonPage />)} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute allow={["admin"]} />}>
      <Route element={<AppLayout />}>
        <Route path="/admin/users" element={withSuspense(<AdminUsersPage />)} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
