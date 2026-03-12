import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  allow?: UserRole[];
}

export const ProtectedRoute = ({ allow }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-dashboard-gradient text-muted-foreground">
        Loading farm command center...
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
