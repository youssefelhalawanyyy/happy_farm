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
import { formatCurrency, formatNumber, isoToday } from "@/lib/utils";
import { recordSale } from "@/services/farmService";
import type { Batch, SaleRecord } from "@/types";

type SaleRow = {
  id: string;
  date: string;
  buyer: string;
  batch: string;
  birds: number;
  avgWeight: string;
  pricePerKg: string;
  revenue: string;
};

export const SalesPage = () => {
  const { profile } = useAuth();
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);

  const activeBatches = batches.filter((batch) => batch.status === "active");

  const [form, setForm] = useState<SaleRecord>({
    buyerName: "",
    batchId: "",
    birdCount: 500,
    averageWeightKg: 2.1,
    pricePerKg: 93,
    totalRevenue: 0,
    saleDate: isoToday()
  });

  const calculatedTotal = useMemo(
    () => Number((form.birdCount * form.averageWeightKg * form.pricePerKg).toFixed(2)),
    [form.averageWeightKg, form.birdCount, form.pricePerKg]
  );

  const submit = async (): Promise<void> => {
    if (!profile || !form.batchId || !form.buyerName) {
      return;
    }

    try {
      await recordSale({ ...form, totalRevenue: calculatedTotal }, profile.uid);
      toast.success("Sale saved and linked to finance");
      setForm((prev) => ({ ...prev, buyerName: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to save sale");
    }
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalRevenue, 0);

  const saleRows = useMemo<SaleRow[]>(
    () =>
      [...sales]
        .sort((a, b) => b.saleDate.localeCompare(a.saleDate))
        .map((sale) => ({
          id: sale.id ?? `${sale.buyerName}-${sale.saleDate}`,
          date: sale.saleDate,
          buyer: sale.buyerName,
          batch: batches.find((batch) => batch.id === sale.batchId)?.batchId ?? sale.batchId,
          birds: sale.birdCount,
          avgWeight: `${sale.averageWeightKg.toFixed(2)} kg`,
          pricePerKg: formatCurrency(sale.pricePerKg),
          revenue: formatCurrency(sale.totalRevenue)
        })),
    [batches, sales]
  );

  const columns = useMemo<ColumnDef<SaleRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date"
      },
      {
        accessorKey: "buyer",
        header: "Buyer"
      },
      {
        accessorKey: "batch",
        header: "Batch"
      },
      {
        accessorKey: "birds",
        header: "Bird Count",
        cell: ({ row }) => formatNumber(row.original.birds)
      },
      {
        accessorKey: "avgWeight",
        header: "Avg Weight"
      },
      {
        accessorKey: "pricePerKg",
        header: "Price/kg"
      },
      {
        accessorKey: "revenue",
        header: "Total Revenue",
        cell: ({ row }) => <Badge variant="success">{row.original.revenue}</Badge>
      }
    ],
    []
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Sales Management"
        description="Capture buyer transactions and auto-sync revenue visibility to finance."
        actions={<Badge variant="success">Revenue: {formatCurrency(totalRevenue)}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Record New Sale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="form-grid">
            <div className="space-y-2">
              <Label>Buyer Name</Label>
              <Input value={form.buyerName} onChange={(event) => setForm((prev) => ({ ...prev, buyerName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={form.batchId} onChange={(event) => setForm((prev) => ({ ...prev, batchId: event.target.value }))}>
                <option value="">Select batch</option>
                {activeBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchId}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bird Count</Label>
              <Input
                type="number"
                value={form.birdCount}
                onChange={(event) => setForm((prev) => ({ ...prev, birdCount: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Average Weight (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.averageWeightKg}
                onChange={(event) => setForm((prev) => ({ ...prev, averageWeightKg: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Price per kg (EGP)</Label>
              <Input
                type="number"
                value={form.pricePerKg}
                onChange={(event) => setForm((prev) => ({ ...prev, pricePerKg: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sale Date</Label>
              <Input
                type="date"
                value={form.saleDate}
                onChange={(event) => setForm((prev) => ({ ...prev, saleDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Calculated Total Revenue</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(calculatedTotal)}</p>
          </div>

          <Button onClick={() => void submit()} disabled={!profile || !form.batchId || !form.buyerName}>
            Save Sale
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Table</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={saleRows} searchColumn="buyer" searchPlaceholder="Search buyer..." />
        </CardContent>
      </Card>
    </section>
  );
};
