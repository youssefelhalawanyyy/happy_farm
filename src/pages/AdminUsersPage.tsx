import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { createUserAccount, generatePasswordResetLink, updateUserAccount } from "@/services/adminService";
import type { UserProfile, UserRole } from "@/types";

export const AdminUsersPage = () => {
  const { data: users } = useRealtimeCollection<UserProfile>(COLLECTIONS.users);

  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "worker" as UserRole,
    assignedHouse: ""
  });

  const create = async (): Promise<void> => {
    if (!form.email || !form.password || !form.displayName) {
      return;
    }

    try {
      await createUserAccount(form);
      toast.success("User account created");
      setForm((prev) => ({ ...prev, email: "", password: "", displayName: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to create user (admin only, functions deploy required)");
    }
  };

  const updateRole = async (uid: string, role: UserRole): Promise<void> => {
    try {
      await updateUserAccount({ uid, role });
      toast.success("Role updated");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update role");
    }
  };

  const toggleDisabled = async (uid: string, disabled: boolean): Promise<void> => {
    try {
      await updateUserAccount({ uid, disabled });
      toast.success(disabled ? "Account disabled" : "Account enabled");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update account status");
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      const { link } = await generatePasswordResetLink(email);
      await navigator.clipboard.writeText(link);
      toast.success("Reset link copied to clipboard");
    } catch (error) {
      console.error(error);
      toast.error("Unable to generate password reset link");
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Admin User Management"
        description="Create users, assign roles, disable access, and issue password reset links."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="form-grid">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="worker">Worker</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned House</Label>
              <Input
                value={form.assignedHouse}
                onChange={(event) => setForm((prev) => ({ ...prev, assignedHouse: event.target.value }))}
              />
            </div>
          </div>
          <Button onClick={() => void create()}>
            <Plus size={14} className="mr-1" />
            Create User
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>House</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <tr key={user.uid}>
                  <TD>{user.displayName}</TD>
                  <TD>{user.email}</TD>
                  <TD>
                    <Select value={user.role} onChange={(event) => void updateRole(user.uid, event.target.value as UserRole)}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="worker">Worker</option>
                    </Select>
                  </TD>
                  <TD>{user.assignedHouse || "-"}</TD>
                  <TD>
                    <Badge variant={user.disabled ? "danger" : "success"}>{user.disabled ? "Disabled" : "Active"}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => void toggleDisabled(user.uid, !user.disabled)}>
                        {user.disabled ? "Enable" : "Disable"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void resetPassword(user.email)}>
                        <Copy size={12} className="mr-1" />
                        Reset link
                      </Button>
                    </div>
                  </TD>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
