import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { compareDateTimeDesc, formatDateTimeLocal } from "@/lib/utils";
import { createAlert, createInventoryItem, recordLivestockAdjustment, updateInventoryQuantity } from "@/services/farmService";
import type { Batch, InventoryCategory, InventoryItem, LivestockAdjustmentReason, LivestockAdjustmentRecord } from "@/types";

const categories: InventoryCategory[] = ["feed", "livestock", "medicine", "vaccines", "equipment", "supplies"];

type StockRegisterRow = {
  id: string;
  source: "batch" | "inventory";
  item: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  reorderLevel: number;
  supplier: string;
  statusLabel: string;
  statusVariant: "success" | "warning" | "danger" | "muted";
  adjustableInventoryId?: string;
};

export const InventoryPage = () => {
  const { profile } = useAuth();
  const { data: items } = useRealtimeCollection<InventoryItem>(COLLECTIONS.inventory);
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: livestockAdjustments } = useRealtimeCollection<LivestockAdjustmentRecord>(COLLECTIONS.livestockAdjustments);

  const [form, setForm] = useState<InventoryItem>({
    name: "",
    category: "feed",
    quantity: 0,
    unit: "kg",
    reorderLevel: 100,
    supplier: ""
  });
  const [livestockAdjustment, setLivestockAdjustment] = useState({
    quantity: 0,
    reason: "dead_loss" as LivestockAdjustmentReason,
    batchId: "",
    note: ""
  });

  const submit = async (): Promise<void> => {
    if (!profile || !form.name) {
      return;
    }

    try {
      await createInventoryItem(form, profile.uid);
      if (form.quantity <= form.reorderLevel) {
        await createAlert(
          {
            title: "Low inventory stock",
            message: `${form.name} is below reorder level`,
            type: "inventory",
            severity: "medium",
            read: false
          },
          profile.uid
        );
      }
      toast.success("Inventory item created");
      setForm((prev) => ({ ...prev, name: "", quantity: 0, supplier: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save inventory item");
    }
  };

  const lowStockCount = useMemo(
    () => items.filter((item) => item.quantity <= item.reorderLevel).length,
    [items]
  );
  const livestockItem = useMemo(
    () => items.find((item) => item.category === "livestock"),
    [items]
  );
  const liveBirdsFromBatches = useMemo(
    () => batches.reduce((sum, batch) => sum + Math.max(batch.currentAliveCount ?? 0, 0), 0),
    [batches]
  );
  const activeBatches = useMemo(
    () => batches.filter((batch) => batch.status === "active").length,
    [batches]
  );
  const livestockCounterDelta = useMemo(
    () => (livestockItem ? liveBirdsFromBatches - livestockItem.quantity : liveBirdsFromBatches),
    [liveBirdsFromBatches, livestockItem]
  );
  const batchLabelById = useMemo(
    () =>
      batches.reduce<Record<string, string>>((acc, batch) => {
        if (batch.id) {
          acc[batch.id] = batch.batchId;
        }
        return acc;
      }, {}),
    [batches]
  );
  const stockRegisterRows = useMemo<StockRegisterRow[]>(() => {
    const batchRows = [...batches]
      .sort((a, b) => compareDateTimeDesc(a.arrivalDate, b.arrivalDate))
      .map((batch) => {
        const birds = Math.max(batch.currentAliveCount ?? 0, 0);
        let statusLabel: string;
        let statusVariant: StockRegisterRow["statusVariant"];

        if (batch.status === "active") {
          statusLabel = birds > 0 ? "Active batch" : "No birds";
          statusVariant = birds > 0 ? "success" : "warning";
        } else if (batch.status === "sold") {
          statusLabel = "Sold";
          statusVariant = "muted";
        } else {
          statusLabel = "Closed";
          statusVariant = "muted";
        }

        return {
          id: `batch-${batch.id ?? batch.batchId}`,
          source: "batch" as const,
          item: `Batch ${batch.batchId}`,
          category: "livestock" as const,
          quantity: birds,
          unit: "birds",
          reorderLevel: 0,
          supplier: `${batch.assignedHouse} / ${batch.breed.toUpperCase()}`,
          statusLabel,
          statusVariant
        };
      });

    const inventoryRows = items
      .map((item) => {
        const isLow = item.quantity <= item.reorderLevel;
        return {
          id: `inventory-${item.id ?? item.name}`,
          source: "inventory" as const,
          item: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          reorderLevel: item.reorderLevel,
          supplier: item.supplier || "-",
          statusLabel: isLow ? "Low stock" : "Healthy",
          statusVariant: isLow ? ("danger" as const) : ("success" as const),
          adjustableInventoryId: item.id
        };
      })
      .sort((a, b) => a.item.localeCompare(b.item));

    return [...batchRows, ...inventoryRows];
  }, [batches, items]);
  const livestockAdjustmentRows = useMemo(
    () =>
      [...livestockAdjustments].sort((a, b) =>
        compareDateTimeDesc(a.adjustedAt || a.createdAt, b.adjustedAt || b.createdAt)
      ),
    [livestockAdjustments]
  );
  const activeBatchOptions = useMemo(
    () => batches.filter((batch) => batch.status === "active" && batch.id),
    [batches]
  );

  const adjustQuantity = async (id: string, delta: number): Promise<void> => {
    if (!profile) {
      return;
    }

    try {
      await updateInventoryQuantity(id, delta, profile.uid);
    } catch (error) {
      console.error(error);
      toast.error("Unable to adjust stock");
    }
  };

  const applyLivestockAdjustment = async (): Promise<void> => {
    if (!profile || !livestockItem?.id || livestockAdjustment.quantity <= 0) {
      return;
    }

    if (livestockAdjustment.reason === "dead_loss" && !livestockAdjustment.batchId) {
      toast.error("Select a batch to track dead/loss against it");
      return;
    }

    try {
      await recordLivestockAdjustment(
        livestockItem.id,
        livestockAdjustment.reason,
        livestockAdjustment.quantity,
        profile.uid,
        livestockAdjustment.note,
        livestockAdjustment.reason === "dead_loss" ? livestockAdjustment.batchId : undefined
      );
      toast.success("Livestock adjustment saved");
      setLivestockAdjustment((prev) => ({
        ...prev,
        quantity: 0,
        note: "",
        batchId: prev.reason === "dead_loss" ? prev.batchId : ""
      }));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to adjust livestock");
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Inventory Management"
        description="Track feed, medicine, vaccines, equipment, and consumables with low stock alerts."
        actions={<Badge variant={lowStockCount > 0 ? "danger" : "success"}>Low stock items: {lowStockCount}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Add Inventory Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="form-grid">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as InventoryCategory }))}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input
                type="number"
                value={form.reorderLevel}
                onChange={(event) => setForm((prev) => ({ ...prev, reorderLevel: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={form.supplier}
                onChange={(event) => setForm((prev) => ({ ...prev, supplier: event.target.value }))}
              />
            </div>
          </div>
          <Button onClick={() => void submit()} disabled={!profile || !form.name}>
            Save Item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Livestock Stock Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Live Birds (All Batches)</p>
              <p className="mt-1 text-2xl font-semibold">{liveBirdsFromBatches.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{activeBatches} active batch(es)</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Livestock Inventory Counter</p>
              <p className="mt-1 text-2xl font-semibold">{(livestockItem?.quantity ?? 0).toLocaleString()}</p>
              <p className={`text-xs ${livestockCounterDelta === 0 ? "text-success" : "text-warning"}`}>
                Delta vs batches: {livestockCounterDelta > 0 ? "+" : ""}
                {livestockCounterDelta.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select
                value={livestockAdjustment.reason}
                onChange={(event) =>
                  setLivestockAdjustment((prev) => ({ ...prev, reason: event.target.value as LivestockAdjustmentReason }))
                }
              >
                <option value="dead_loss">Dead/Loss</option>
                <option value="manual_correction">Manual Correction</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birds to Deduct</Label>
              <Input
                type="number"
                value={livestockAdjustment.quantity}
                onChange={(event) =>
                  setLivestockAdjustment((prev) => ({ ...prev, quantity: Math.max(Number(event.target.value), 0) }))
                }
              />
            </div>
            {livestockAdjustment.reason === "dead_loss" ? (
              <div className="space-y-2">
                <Label>Batch (required for dead/loss)</Label>
                <Select
                  value={livestockAdjustment.batchId}
                  onChange={(event) => setLivestockAdjustment((prev) => ({ ...prev, batchId: event.target.value }))}
                >
                  <option value="">Select batch</option>
                  {activeBatchOptions.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchId} - {batch.assignedHouse}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={livestockAdjustment.note}
                onChange={(event) => setLivestockAdjustment((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="e.g. heat stress in House-B"
              />
            </div>
          </div>
          <Button onClick={() => void applyLivestockAdjustment()} disabled={!profile || !livestockItem}>
            Save Livestock Adjustment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Livestock Adjustment Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Date & Time</TH>
                <TH>Type</TH>
                <TH>Batch</TH>
                <TH>Birds Deducted</TH>
                <TH>Stock Before</TH>
                <TH>Stock After</TH>
                <TH>Note</TH>
              </tr>
            </TableHead>
            <TableBody>
              {livestockAdjustmentRows.map((row) => (
                <tr key={row.id}>
                  <TD>{formatDateTimeLocal(row.adjustedAt || row.createdAt)}</TD>
                  <TD className="capitalize">{row.reason.replace("_", " ")}</TD>
                  <TD>{(row.batchId && batchLabelById[row.batchId]) || "-"}</TD>
                  <TD>{row.quantity.toLocaleString()}</TD>
                  <TD>{row.stockBefore.toLocaleString()}</TD>
                  <TD>{row.stockAfter.toLocaleString()}</TD>
                  <TD>{row.note || "-"}</TD>
                </tr>
              ))}
              {livestockAdjustmentRows.length === 0 ? (
                <tr>
                  <TD colSpan={7}>
                    <div className="py-3 text-sm text-muted-foreground">No livestock adjustments recorded yet.</div>
                  </TD>
                </tr>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Register</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH>Quantity</TH>
                <TH>Reorder</TH>
                <TH>Supplier</TH>
                <TH>Status</TH>
                <TH>Adjust</TH>
              </tr>
            </TableHead>
            <TableBody>
              {stockRegisterRows.map((row) => (
                <tr key={row.id}>
                  <TD>{row.item}</TD>
                  <TD className="capitalize">{row.category}</TD>
                  <TD>
                    {row.quantity.toLocaleString()} {row.unit}
                  </TD>
                  <TD>{row.source === "inventory" ? `${row.reorderLevel.toLocaleString()} ${row.unit}` : "-"}</TD>
                  <TD>{row.supplier}</TD>
                  <TD>
                    <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
                  </TD>
                  <TD>
                    {row.source === "inventory" && row.adjustableInventoryId ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => void adjustQuantity(row.adjustableInventoryId!, -50)}>
                          <Minus size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void adjustQuantity(row.adjustableInventoryId!, 50)}>
                          <Plus size={12} />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Managed from batches</span>
                    )}
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
