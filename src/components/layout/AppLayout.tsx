import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export const AppLayout = () => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />
    <main className="w-full p-4 lg:p-6">
      <div className="mx-auto w-full max-w-[1680px]">
        <Topbar />
      </div>
      <div className="mx-auto w-full max-w-[1680px] space-y-5">
        <Outlet />
      </div>
    </main>
  </div>
);
