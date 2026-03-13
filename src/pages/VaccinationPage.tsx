import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Plus, ShieldCheck, Syringe } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import {
  generateBatchSchedule,
  saveVaccinationSchedule,
  markVaccinationDone,
  markVaccinationSkipped,
  isOverdue,
  isDueToday,
  isDueSoon,
  ROUTE_LABELS,
} from "@/services/vaccinationService";
import type { Batch, VaccinationScheduleEntry } from "@/types";
import { toast } from "react-toastify";
import { formatDateOnly } from "@/lib/utils";

/* ─── Status helpers ─────────────────────────────────────────────────────── */
const entryStatusConfig = (entry: VaccinationScheduleEntry) => {
  if (entry.status === "done")
    return { icon: CheckCircle2, label: "Done", bg: "bg-success/10 border-success/25 text-success", badge: "success" as const };
  if (entry.status === "skipped")
    return { icon: Clock, label: "Skipped", bg: "bg-muted/40 border-border/50 text-muted-foreground", badge: "muted" as const };
  if (isOverdue(entry))
    return { icon: AlertTriangle, label: "Overdue", bg: "bg-danger/8 border-danger/25 text-danger", badge: "danger" as const };
  if (isDueToday(entry))
    return { icon: Clock, label: "Due Today", bg: "bg-warning/8 border-warning/30 text-warning", badge: "warning" as const };
  if (isDueSoon(entry))
    return { icon: Clock, label: "Due Soon", bg: "bg-info/8 border-info/25 text-info", badge: "default" as const };
  return { icon: Clock, label: "Pending", bg: "bg-muted/20 border-border/40 text-muted-foreground", badge: "muted" as const };
};

/* ─── Single entry row ───────────────────────────────────────────────────── */
const VaxEntry = ({
  entry,
  onDone,
  onSkip,
  canEdit,
}: {
  entry: VaccinationScheduleEntry;
  onDone: (id: string) => void;
  onSkip: (id: string) => void;
  canEdit: boolean;
}) => {
  const cfg = entryStatusConfig(entry);
  const Icon = cfg.icon;
  const isPending = entry.status === "pending";

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${cfg.bg} transition-all`}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          entry.status === "done" ? "border-success/40 bg-success/15" :
          isOverdue(entry) ? "border-danger/40 bg-danger/15" :
          isDueToday(entry) ? "border-warning/40 bg-warning/15" :
          "border-border/50 bg-muted/30"
        }`}>
          <Icon size={13} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{entry.diseaseName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.vaccine}</p>
          </div>
          <Badge variant={cfg.badge} className="shrink-0 text-[10px]">{cfg.label}</Badge>
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Syringe size={11} />
            {ROUTE_LABELS[entry.route] ?? entry.route}
          </span>
          <span>Day {entry.dayOfAge}</span>
          <span>{formatDateOnly(entry.scheduledDate)}</span>
          {entry.notes && <span className="text-accent italic">{entry.notes}</span>}
        </div>

        {entry.status === "done" && entry.completedBy && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Completed by {entry.completedBy} on {entry.completedAt ? formatDateOnly(entry.completedAt.slice(0, 10)) : "—"}
          </p>
        )}

        {isPending && canEdit && (
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onDone(entry.id!)}>
              <CheckCircle2 size={11} /> Mark Done
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSkip(entry.id!)}>
              Skip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Batch card ─────────────────────────────────────────────────────────── */
const BatchVaxCard = ({
  batch,
  entries,
  onDone,
  onSkip,
  canEdit,
}: {
  batch: Batch;
  entries: VaccinationScheduleEntry[];
  onDone: (id: string) => void;
  onSkip: (id: string) => void;
  canEdit: boolean;
}) => {
  const [expanded, setExpanded] = useState(true);
  const doneCount = entries.filter((e) => e.status === "done").length;
  const overdueCount = entries.filter((e) => isOverdue(e)).length;
  const todayCount = entries.filter((e) => isDueToday(e)).length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-3 select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {expanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            <div>
              <CardTitle className="text-base">{batch.batchId}</CardTitle>
              <CardDescription className="text-xs">
                {batch.breed.toUpperCase()} · {batch.supplierHatchery} · Arrived {formatDateOnly(batch.arrivalDate)}
              </CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {overdueCount > 0 && <Badge variant="danger" className="text-[10px]">{overdueCount} overdue</Badge>}
            {todayCount > 0 && <Badge variant="warning" className="text-[10px]">{todayCount} today</Badge>}
            <Badge variant="muted" className="text-[10px]">{doneCount}/{entries.length} done</Badge>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          {entries.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">No schedule entries for this batch.</p>
          ) : (
            entries.map((entry) => (
              <VaxEntry key={entry.id} entry={entry} onDone={onDone} onSkip={onSkip} canEdit={canEdit} />
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
};

/* ─── Page ───────────────────────────────────────────────────────────────── */
export const VaccinationPage = () => {
  const { profile } = useAuth();
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: scheduleEntries } = useRealtimeCollection<VaccinationScheduleEntry>(COLLECTIONS.vaccinationSchedule);

  const [generating, setGenerating] = useState<string | null>(null);

  const canEdit = profile?.role !== "worker" || true; // workers can also mark done

  const activeBatches = useMemo(() => batches.filter((b) => b.status === "active"), [batches]);
  const allBatches = useMemo(() => [...activeBatches, ...batches.filter((b) => b.status !== "active")], [batches, activeBatches]);

  // Batches that already have a schedule
  const batchesWithSchedule = useMemo(
    () => new Set(scheduleEntries.map((e) => e.batchId)),
    [scheduleEntries]
  );

  // Group entries by batch
  const entriesByBatch = useMemo(() => {
    const map: Record<string, VaccinationScheduleEntry[]> = {};
    for (const entry of scheduleEntries) {
      if (!map[entry.batchId]) map[entry.batchId] = [];
      map[entry.batchId].push(entry);
    }
    // Sort each batch entries by scheduled date
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    }
    return map;
  }, [scheduleEntries]);

  // Summary stats
  const overdueTotal = scheduleEntries.filter(isOverdue).length;
  const todayTotal = scheduleEntries.filter(isDueToday).length;
  const doneTotal = scheduleEntries.filter((e) => e.status === "done").length;
  const pendingTotal = scheduleEntries.filter((e) => e.status === "pending").length;

  const handleGenerateSchedule = async (batch: Batch) => {
    if (!profile) return;
    setGenerating(batch.id ?? batch.batchId);
    try {
      const entries = generateBatchSchedule(batch);
      await saveVaccinationSchedule(entries, profile.uid);
      toast.success(`Schedule generated for ${batch.batchId}`);
    } catch {
      toast.error("Failed to generate schedule. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  const handleDone = async (entryId: string) => {
    if (!profile) return;
    try {
      await markVaccinationDone(entryId, profile.displayName);
      toast.success("Vaccination marked as done");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSkip = async (entryId: string) => {
    if (!profile) return;
    try {
      await markVaccinationSkipped(entryId, profile.uid);
      toast.info("Vaccination skipped");
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <section className="page-section">
      <PageHeader
        title="Vaccination Schedules"
        description="Track and manage vaccination programs per batch. Auto-generate from the standard broiler protocol."
        actions={
          <Badge variant={overdueTotal > 0 ? "danger" : "success"} className="gap-1">
            <ShieldCheck size={11} />
            {overdueTotal > 0 ? `${overdueTotal} overdue` : "Up to date"}
          </Badge>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Overdue", value: overdueTotal, cls: overdueTotal > 0 ? "text-danger" : "text-foreground" },
          { label: "Due Today", value: todayTotal, cls: todayTotal > 0 ? "text-warning" : "text-foreground" },
          { label: "Pending", value: pendingTotal, cls: "text-foreground" },
          { label: "Completed", value: doneTotal, cls: "text-success" },
        ].map(({ label, value, cls }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batches needing a schedule */}
      {activeBatches.filter((b) => !batchesWithSchedule.has(b.id ?? b.batchId)).length > 0 && (
        <Card className="border-primary/30 bg-primary/4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Plus size={15} />
              Generate Vaccination Schedules
            </CardTitle>
            <CardDescription>
              Active batches without a vaccination schedule. Generate one from the standard broiler protocol.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {activeBatches
                .filter((b) => !batchesWithSchedule.has(b.id ?? b.batchId))
                .map((batch) => (
                  <Button
                    key={batch.id}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={generating === (batch.id ?? batch.batchId)}
                    onClick={() => handleGenerateSchedule(batch)}
                  >
                    <Syringe size={13} />
                    {generating === (batch.id ?? batch.batchId) ? "Generating..." : `Generate for ${batch.batchId}`}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standard protocol reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            Standard Broiler Vaccination Protocol
          </CardTitle>
          <CardDescription>Applied automatically when generating a batch schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { day: 1,  name: "Marek's Disease",     vaccine: "HVT / Rispens",     route: "Injection",      note: "At hatchery" },
              { day: 7,  name: "Newcastle (NDV)",      vaccine: "Lasota / Clone 30", route: "Drinking Water" },
              { day: 14, name: "Gumboro (IBD)",        vaccine: "Intermediate IBD",  route: "Drinking Water", note: "Critical window" },
              { day: 21, name: "Newcastle (Booster)",  vaccine: "Lasota",            route: "Drinking Water" },
              { day: 28, name: "Infect. Bronchitis",   vaccine: "IB Ma5 / H120",     route: "Spray",          note: "Optional" },
            ].map((item) => (
              <div key={item.day} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <span className="vax-day-badge bg-primary/12 text-primary">Day {item.day}</span>
                <div>
                  <p className="text-xs font-semibold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.vaccine}</p>
                  <p className="text-[11px] text-muted-foreground">{item.route}{item.note ? ` · ${item.note}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch schedules */}
      {allBatches.filter((b) => batchesWithSchedule.has(b.id ?? b.batchId)).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No vaccination schedules yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Generate a schedule for your active batches using the button above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allBatches
            .filter((b) => batchesWithSchedule.has(b.id ?? b.batchId))
            .map((batch) => (
              <BatchVaxCard
                key={batch.id}
                batch={batch}
                entries={entriesByBatch[batch.id ?? batch.batchId] ?? []}
                onDone={handleDone}
                onSkip={handleSkip}
                canEdit={canEdit}
              />
            ))}
        </div>
      )}
    </section>
  );
};
