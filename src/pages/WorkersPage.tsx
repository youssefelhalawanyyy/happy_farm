import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { createTask, createWorker } from "@/services/farmService";
import type { UserRole, WorkerProfile, WorkerTask } from "@/types";

type WorkerRow = {
  id: string;
  name: string;
  uid: string;
  role: UserRole;
  house: string;
  contact: string;
  status: "active" | "inactive";
};

type TaskRow = {
  id: string;
  task: string;
  worker: string;
  house: string;
  dueDate: string;
  status: WorkerTask["status"];
};

export const WorkersPage = () => {
  const { profile } = useAuth();
  const { data: workers } = useRealtimeCollection<WorkerProfile>(COLLECTIONS.workers);
  const { data: tasks } = useRealtimeCollection<WorkerTask>(COLLECTIONS.tasks);

  const [workerForm, setWorkerForm] = useState<WorkerProfile>({
    uid: "",
    name: "",
    role: "worker",
    assignedHouse: "House-A",
    contact: "",
    active: true
  });

  const [taskForm, setTaskForm] = useState<WorkerTask>({
    title: "",
    description: "",
    assignedToUid: "",
    assignedHouse: "House-A",
    dueDate: new Date().toISOString().slice(0, 10),
    status: "todo"
  });

  const submitWorker = async (): Promise<void> => {
    if (!profile || !workerForm.name || !workerForm.uid) {
      return;
    }

    try {
      await createWorker(workerForm, profile.uid);
      toast.success("Worker profile saved");
      setWorkerForm((prev) => ({ ...prev, name: "", contact: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save worker");
    }
  };

  const submitTask = async (): Promise<void> => {
    if (!profile || !taskForm.title || !taskForm.assignedToUid) {
      return;
    }

    try {
      await createTask(taskForm, profile.uid);
      toast.success("Task created");
      setTaskForm((prev) => ({ ...prev, title: "", description: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save task");
    }
  };

  const workerRows = useMemo<WorkerRow[]>(
    () =>
      workers.map((worker) => ({
        id: worker.id ?? worker.uid,
        name: worker.name,
        uid: worker.uid,
        role: worker.role,
        house: worker.assignedHouse ?? "-",
        contact: worker.contact ?? "-",
        status: worker.active ? "active" : "inactive"
      })),
    [workers]
  );

  const taskRows = useMemo<TaskRow[]>(
    () =>
      tasks.map((task) => ({
        id: task.id ?? `${task.assignedToUid}-${task.title}`,
        task: task.description ? `${task.title} — ${task.description}` : task.title,
        worker: workers.find((worker) => worker.uid === task.assignedToUid)?.name ?? task.assignedToUid,
        house: task.assignedHouse ?? "-",
        dueDate: task.dueDate,
        status: task.status
      })),
    [tasks, workers]
  );

  const workerColumns = useMemo<ColumnDef<WorkerRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name"
      },
      {
        accessorKey: "uid",
        header: "UID"
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <span className="capitalize">{row.original.role}</span>
      },
      {
        accessorKey: "house",
        header: "House"
      },
      {
        accessorKey: "contact",
        header: "Contact"
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "success" : "muted"}>{row.original.status}</Badge>
        )
      }
    ],
    []
  );

  const taskColumns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        accessorKey: "task",
        header: "Task"
      },
      {
        accessorKey: "worker",
        header: "Assigned To"
      },
      {
        accessorKey: "house",
        header: "House"
      },
      {
        accessorKey: "dueDate",
        header: "Due Date"
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "done" ? "success" : row.original.status === "in_progress" ? "warning" : "muted"}>
            {row.original.status}
          </Badge>
        )
      }
    ],
    []
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Worker Management"
        description="Manage staff, assign farm houses, and track operations tasks."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Worker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="form-grid">
              <div className="space-y-2">
                <Label>User UID</Label>
                <Input
                  value={workerForm.uid}
                  onChange={(event) => setWorkerForm((prev) => ({ ...prev, uid: event.target.value }))}
                  placeholder="Firebase Auth UID"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={workerForm.name} onChange={(event) => setWorkerForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={workerForm.role}
                  onChange={(event) =>
                    setWorkerForm((prev) => ({
                      ...prev,
                      role: event.target.value as UserRole
                    }))
                  }
                >
                  <option value="worker">Worker</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned House</Label>
                <Input
                  value={workerForm.assignedHouse}
                  onChange={(event) => setWorkerForm((prev) => ({ ...prev, assignedHouse: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Input
                  value={workerForm.contact}
                  onChange={(event) => setWorkerForm((prev) => ({ ...prev, contact: event.target.value }))}
                />
              </div>
            </div>
            <Button onClick={() => void submitWorker()} disabled={!profile || !workerForm.uid || !workerForm.name}>
              Save Worker
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="form-grid">
              <div className="space-y-2">
                <Label>Task Title</Label>
                <Input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={taskForm.assignedToUid}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, assignedToUid: event.target.value }))}
                >
                  <option value="">Select worker</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.uid}>
                      {worker.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>House</Label>
                <Input
                  value={taskForm.assignedHouse}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, assignedHouse: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>
            <Button onClick={() => void submitTask()} disabled={!profile || !taskForm.assignedToUid || !taskForm.title}>
              Create Task
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workers Table</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={workerColumns} data={workerRows} searchColumn="name" searchPlaceholder="Search worker..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={taskColumns} data={taskRows} searchColumn="worker" searchPlaceholder="Search assigned worker..." />
        </CardContent>
      </Card>
    </section>
  );
};
