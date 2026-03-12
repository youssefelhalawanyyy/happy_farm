import type { UserRole } from "@/types";

const matrix = {
  canManageUsers: ["admin"],
  canManageBatches: ["admin", "manager"],
  canManageFinance: ["admin", "manager"],
  canViewReports: ["admin", "manager"],
  canRecordOperations: ["admin", "manager", "worker"]
} satisfies Record<string, UserRole[]>;

export type PermissionKey = keyof typeof matrix;

export const hasPermission = (role: UserRole | undefined, permission: PermissionKey): boolean => {
  if (!role) {
    return false;
  }

  return (matrix[permission] as UserRole[]).includes(role);
};
