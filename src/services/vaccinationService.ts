import { addDays, format, parseISO } from "date-fns";
import type { Batch, VaccinationScheduleEntry, VaccinationProtocolItem } from "@/types";
import { STANDARD_BROILER_PROTOCOL } from "@/types";
import { COLLECTIONS } from "@/lib/constants";
import { createDocument, subscribeCollection } from "@/lib/firestore";
import { where } from "firebase/firestore";
import type { QueryConstraint } from "firebase/firestore";

/* Generate a vaccination schedule for a batch from the standard protocol */
export const generateBatchSchedule = (batch: Batch): Omit<VaccinationScheduleEntry, "id">[] => {
  const arrival = parseISO(batch.arrivalDate);
  const ageOffset = batch.chickAgeAtArrivalDays ?? 0;

  return STANDARD_BROILER_PROTOCOL.map((item: VaccinationProtocolItem) => {
    const daysFromArrival = Math.max(0, item.dayOfAge - ageOffset);
    const scheduledDate = format(addDays(arrival, daysFromArrival), "yyyy-MM-dd");

    return {
      batchId: batch.id ?? batch.batchId,
      dayOfAge: item.dayOfAge,
      diseaseName: item.diseaseName,
      vaccine: item.vaccine,
      route: item.route,
      scheduledDate,
      status: "pending" as const,
      notes: item.notes,
    };
  });
};

/* Save generated schedule to Firestore */
export const saveVaccinationSchedule = async (
  entries: Omit<VaccinationScheduleEntry, "id">[],
  userId: string
): Promise<void> => {
  for (const entry of entries) {
    await createDocument(COLLECTIONS.vaccinationSchedule, entry, userId);
  }
};

/* Mark a vaccination entry as done */
export const markVaccinationDone = async (
  entryId: string,
  completedBy: string
): Promise<void> => {
  const { updateDocument } = await import("@/lib/firestore");
  await updateDocument(COLLECTIONS.vaccinationSchedule, entryId, {
    status: "done",
    completedAt: new Date().toISOString(),
    completedBy,
  }, completedBy);
};

/* Mark a vaccination entry as skipped */
export const markVaccinationSkipped = async (
  entryId: string,
  userId: string
): Promise<void> => {
  const { updateDocument } = await import("@/lib/firestore");
  await updateDocument(COLLECTIONS.vaccinationSchedule, entryId, {
    status: "skipped",
  }, userId);
};

/* Today or overdue filter */
export const isOverdue = (entry: VaccinationScheduleEntry): boolean => {
  if (entry.status !== "pending") return false;
  return entry.scheduledDate < new Date().toISOString().slice(0, 10);
};

export const isDueToday = (entry: VaccinationScheduleEntry): boolean => {
  if (entry.status !== "pending") return false;
  return entry.scheduledDate === new Date().toISOString().slice(0, 10);
};

export const isDueSoon = (entry: VaccinationScheduleEntry): boolean => {
  if (entry.status !== "pending") return false;
  const today = new Date();
  const due = parseISO(entry.scheduledDate);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 3;
};

export const ROUTE_LABELS: Record<string, string> = {
  drinking_water: "Drinking Water",
  spray: "Spray",
  eye_drop: "Eye Drop",
  injection: "Injection",
  in_ovo: "In Ovo",
};
