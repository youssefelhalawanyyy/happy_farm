import { useMemo, useState } from "react";
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
import type { Batch, MortalityRecord } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { recordMortality } from "@/services/farmService";
import { formatNumber, isoToday } from "@/lib/utils";

export const MortalityPage = () => {
  const { profile } = useAuth();
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: mortality } = useRealtimeCollection<MortalityRecord>(COLLECTIONS.mortalityRecords);

  const activeBatches = batches.filter((batch) => batch.status === "active");

  const [form, setForm] = useState<MortalityRecord>({
    batchId: "",
    recordDate: isoToday(),
    birds: 0,
    cause: ""
  });

  const submit = async (): Promise<void> => {
    if (!profile || !form.batchId || form.birds <= 0) {
      return;
    }

    try {
      const result = await recordMortality(form, profile.uid);
      toast.success(result.alertId ? "Mortality logged. Alert triggered." : "Mortality logged");
      setForm((prev) => ({ ...prev, birds: 0, cause: "" }));
    } catch (error) {
      console.error(error);
      toast.error("Unable to log mortality");
    }
  };

  const mortalityToday = mortality
    .filter((row) => row.recordDate === isoToday())
    .reduce((sum, row) => sum + row.birds, 0);

  const mortalityByBatch = useMemo(
    () =>
      activeBatches.map((batch) => {
        const dead = mortality
          .filter((entry) => entry.batchId === batch.id)
          .reduce((sum, entry) => sum + entry.birds, 0);

        return {
          batch: batch.batchId,
          dead,
          rate: batch.initialChickCount > 0 ? (dead / batch.initialChickCount) * 100 : 0
        };
      }),
    [activeBatches, mortality]
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Mortality Tracking"
        description="Record daily losses and flag unusual spikes instantly."
        actions={<Badge variant="danger">Today: {formatNumber(mortalityToday)} birds</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record Mortality Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="form-grid">
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
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.recordDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, recordDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Birds</Label>
                <Input
                  type="number"
                  value={form.birds}
                  onChange={(event) => setForm((prev) => ({ ...prev, birds: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cause (optional)</Label>
                <Input value={form.cause} onChange={(event) => setForm((prev) => ({ ...prev, cause: event.target.value }))} />
              </div>
            </div>
            <Button onClick={() => void submit()} disabled={!profile || !form.batchId || form.birds <= 0}>
              Save Mortality
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Mortality Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TH>Batch</TH>
                  <TH>Total Dead</TH>
                  <TH>Rate</TH>
                </tr>
              </TableHead>
              <TableBody>
                {mortalityByBatch.map((row) => (
                  <tr key={row.batch}>
                    <TD>{row.batch}</TD>
                    <TD>{row.dead}</TD>
                    <TD>
                      <Badge variant={row.rate <= 4 ? "success" : row.rate <= 6 ? "warning" : "danger"}>
                        {row.rate.toFixed(2)}%
                      </Badge>
                    </TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mortality Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Date</TH>
                <TH>Batch</TH>
                <TH>Birds</TH>
                <TH>Cause</TH>
              </tr>
            </TableHead>
            <TableBody>
              {mortality
                .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
                .map((row) => (
                  <tr key={row.id}>
                    <TD>{row.recordDate}</TD>
                    <TD>{activeBatches.find((batch) => batch.id === row.batchId)?.batchId ?? row.batchId}</TD>
                    <TD>{row.birds}</TD>
                    <TD>{row.cause || "-"}</TD>
                  </tr>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
