import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { createDocument, setDocument } from "@/lib/firestore";
import { COLLECTIONS, LIVESTOCK_INVENTORY_NAME, SAFE_THRESHOLDS } from "@/lib/constants";
import { createId } from "@/lib/id";
import { db } from "@/lib/firebase";
import type {
  Alert,
  Batch,
  EnvironmentReading,
  ExpenseRecord,
  FeedRecord,
  GrowthRecord,
  InventoryItem,
  LivestockAdjustmentReason,
  LivestockAdjustmentRecord,
  MortalityRecord,
  Quotation,
  SaleRecord,
  WorkerProfile,
  WorkerTask
} from "@/types";

const findLivestockInventory = async (): Promise<InventoryItem | null> => {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.inventory),
      where("category", "==", "livestock"),
      where("name", "==", LIVESTOCK_INVENTORY_NAME),
      limit(1)
    )
  );
  const row = snapshot.docs[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ...(row.data() as InventoryItem)
  };
};

const adjustLivestockInventory = async (delta: number, actorUid: string): Promise<void> => {
  const livestock = await findLivestockInventory();

  if (!livestock) {
    if (delta <= 0) {
      return;
    }

    await createDocument<InventoryItem>(
      COLLECTIONS.inventory,
      {
        name: LIVESTOCK_INVENTORY_NAME,
        category: "livestock",
        quantity: delta,
        unit: "birds",
        reorderLevel: 500,
        supplier: "Internal hatchery intake"
      },
      actorUid
    );
    return;
  }

  const nextQuantity = Math.max((livestock.quantity ?? 0) + delta, 0);

  await updateDoc(doc(db, COLLECTIONS.inventory, livestock.id!), {
    quantity: nextQuantity,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid
  });
};

export const createBatch = async (batch: Batch, actorUid: string): Promise<string> => {
  const payload: Batch = {
    ...batch,
    batchCost: batch.batchCost ?? batch.initialChickCount * batch.chickPrice
  };

  const batchId = await createDocument<Batch>(COLLECTIONS.batches, payload, actorUid);
  await adjustLivestockInventory(payload.initialChickCount, actorUid);
  return batchId;
};

export const updateBatch = async (id: string, payload: Partial<Batch>, actorUid: string): Promise<void> =>
  setDocument<Partial<Batch>>(COLLECTIONS.batches, id, payload, actorUid);

export const recordFeedUsage = async (feed: FeedRecord, actorUid: string): Promise<string> =>
  createDocument<FeedRecord>(COLLECTIONS.feedRecords, feed, actorUid);

export const recordGrowth = async (growth: GrowthRecord, actorUid: string): Promise<string> =>
  createDocument<GrowthRecord>(COLLECTIONS.growthRecords, growth, actorUid);

export const createAlert = async (alert: Alert, actorUid?: string): Promise<string> =>
  createDocument<Alert>(COLLECTIONS.alerts, alert, actorUid);

export const recordMortality = async (
  mortality: MortalityRecord,
  actorUid: string
): Promise<{ mortalityId: string; alertId?: string }> => {
  const mortalityId = await createDocument<MortalityRecord>(COLLECTIONS.mortalityRecords, mortality, actorUid);
  const batchRef = doc(db, COLLECTIONS.batches, mortality.batchId);

  let alertId: string | undefined;

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(batchRef);
    if (!snapshot.exists()) {
      return;
    }

    const batch = snapshot.data() as Batch;
    const nextMortality = Math.max((batch.mortalityCount ?? 0) + mortality.birds, 0);
    const nextAlive = Math.max((batch.currentAliveCount ?? batch.initialChickCount) - mortality.birds, 0);

    transaction.update(batchRef, {
      mortalityCount: nextMortality,
      currentAliveCount: nextAlive,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid
    });

    const mortalityRate = batch.initialChickCount > 0 ? (mortality.birds / batch.initialChickCount) * 100 : 0;
    if (mortalityRate >= SAFE_THRESHOLDS.mortalityPercentDaily) {
      alertId = createId();
      transaction.set(doc(db, COLLECTIONS.alerts, alertId), {
        title: "Mortality spike detected",
        message: `Batch ${batch.batchId} reported ${mortality.birds} deaths on ${mortality.recordDate}`,
        type: "mortality",
        severity: "high",
        read: false,
        batchId: mortality.batchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actorUid,
        updatedBy: actorUid
      });
    }
  });

  await adjustLivestockInventory(-mortality.birds, actorUid);

  return { mortalityId, alertId };
};

export const recordEnvironmentReading = async (
  reading: EnvironmentReading,
  actorUid?: string
): Promise<{ id: string; alertIds: string[] }> => {
  const id = await createDocument<EnvironmentReading>(COLLECTIONS.environmentReadings, reading, actorUid);
  const alertIds: string[] = [];

  if (reading.temperatureC > SAFE_THRESHOLDS.temperatureHigh || reading.temperatureC < SAFE_THRESHOLDS.temperatureLow) {
    const alertId = await createAlert(
      {
        title: "Temperature out of range",
        message: `${reading.houseId} is at ${reading.temperatureC}°C (safe: ${SAFE_THRESHOLDS.temperatureLow}-${SAFE_THRESHOLDS.temperatureHigh}°C)`,
        type: "temperature",
        severity: "high",
        read: false
      },
      actorUid
    );
    alertIds.push(alertId);
  }

  if (reading.ammoniaPpm > SAFE_THRESHOLDS.ammoniaHigh) {
    const alertId = await createAlert(
      {
        title: "Ammonia warning",
        message: `${reading.houseId} ammonia reached ${reading.ammoniaPpm} ppm`,
        type: "temperature",
        severity: "medium",
        read: false
      },
      actorUid
    );
    alertIds.push(alertId);
  }

  return { id, alertIds };
};

export const recordSale = async (sale: SaleRecord, actorUid: string): Promise<string> => {
  const saleId = await createDocument<SaleRecord>(COLLECTIONS.sales, sale, actorUid);
  const batchRef = doc(db, COLLECTIONS.batches, sale.batchId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(batchRef);
    if (!snapshot.exists()) {
      return;
    }

    const batch = snapshot.data() as Batch;
    const remaining = Math.max((batch.currentAliveCount ?? 0) - sale.birdCount, 0);

    transaction.update(batchRef, {
      currentAliveCount: remaining,
      status: remaining === 0 ? "sold" : batch.status,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid
    });
  });

  await adjustLivestockInventory(-sale.birdCount, actorUid);
  return saleId;
};

export const updateSale = async (id: string, payload: Partial<SaleRecord>, actorUid: string): Promise<void> =>
  setDocument<Partial<SaleRecord>>(COLLECTIONS.sales, id, payload, actorUid);

export const createExpense = async (expense: ExpenseRecord, actorUid: string): Promise<string> =>
  createDocument<ExpenseRecord>(COLLECTIONS.expenses, expense, actorUid);

export const createInventoryItem = async (item: InventoryItem, actorUid: string): Promise<string> =>
  createDocument<InventoryItem>(COLLECTIONS.inventory, item, actorUid);

export const updateInventoryQuantity = async (
  id: string,
  amountDelta: number,
  actorUid: string
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.inventory, id), {
    quantity: increment(amountDelta),
    updatedAt: serverTimestamp(),
    updatedBy: actorUid
  });
};

export const recordLivestockAdjustment = async (
  inventoryId: string,
  reason: LivestockAdjustmentReason,
  quantity: number,
  actorUid: string,
  note?: string,
  batchId?: string
): Promise<string> => {
  const safeQuantity = Math.max(Math.round(quantity), 0);
  if (safeQuantity <= 0) {
    throw new Error("Invalid livestock adjustment quantity");
  }

  const inventoryRef = doc(db, COLLECTIONS.inventory, inventoryId);
  const adjustmentId = createId();
  const adjustmentRef = doc(db, COLLECTIONS.livestockAdjustments, adjustmentId);
  const adjustedAt = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) {
      throw new Error("Livestock inventory item not found");
    }

    const inventory = inventorySnapshot.data() as InventoryItem;
    const stockBefore = Math.max(Number(inventory.quantity ?? 0), 0);
    let appliedQuantity = safeQuantity;
    let resolvedBatchId = batchId?.trim() || "";

    if (reason === "dead_loss") {
      if (!resolvedBatchId) {
        throw new Error("Please select a batch for dead/loss tracking");
      }

      const batchRef = doc(db, COLLECTIONS.batches, resolvedBatchId);
      const batchSnapshot = await transaction.get(batchRef);
      if (!batchSnapshot.exists()) {
        throw new Error("Selected batch was not found");
      }

      const batch = batchSnapshot.data() as Batch;
      const batchAlive = Math.max(batch.currentAliveCount ?? 0, 0);
      appliedQuantity = Math.min(appliedQuantity, batchAlive);
      if (appliedQuantity <= 0) {
        throw new Error("Selected batch has no live birds to deduct");
      }

      const nextAlive = Math.max(batchAlive - appliedQuantity, 0);
      const nextMortality = Math.max((batch.mortalityCount ?? 0) + appliedQuantity, 0);
      const nextStatus = nextAlive === 0 && batch.status === "active" ? "closed" : batch.status;

      transaction.update(batchRef, {
        currentAliveCount: nextAlive,
        mortalityCount: nextMortality,
        status: nextStatus,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
      });
    } else {
      resolvedBatchId = "";
      appliedQuantity = Math.min(appliedQuantity, stockBefore);
      if (appliedQuantity <= 0) {
        throw new Error("No livestock available in stock to deduct");
      }
    }

    const stockAfter = Math.max(stockBefore - appliedQuantity, 0);
    const appliedDelta = stockAfter - stockBefore;

    // Keep livestock inventory non-negative and synced after batch/manual deductions.

    transaction.update(inventoryRef, {
      quantity: stockAfter,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid
    });

    transaction.set(adjustmentRef, {
      quantity: appliedQuantity,
      delta: appliedDelta,
      reason,
      batchId: resolvedBatchId || undefined,
      note: note?.trim() || "",
      stockBefore,
      stockAfter,
      adjustedAt,
      createdBy: actorUid,
      updatedBy: actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as LivestockAdjustmentRecord);
  });

  return adjustmentId;
};

export const createWorker = async (worker: WorkerProfile, actorUid: string): Promise<string> =>
  createDocument<WorkerProfile>(COLLECTIONS.workers, worker, actorUid);

export const createTask = async (task: WorkerTask, actorUid: string): Promise<string> =>
  createDocument<WorkerTask>(COLLECTIONS.tasks, task, actorUid);

export const saveQuotation = async (quotation: Quotation, actorUid: string): Promise<string> =>
  createDocument<Quotation>(COLLECTIONS.quotations, quotation, actorUid);

export const updateQuotation = async (id: string, payload: Partial<Quotation>, actorUid: string): Promise<void> =>
  setDocument<Partial<Quotation>>(COLLECTIONS.quotations, id, payload, actorUid);

export const markAlertRead = async (alertId: string, actorUid: string): Promise<void> => {
  await setDocument<Partial<Alert>>(COLLECTIONS.alerts, alertId, { read: true }, actorUid);
};

export const ensureWorkerProfile = async (uid: string, actorUid: string): Promise<void> => {
  const ref = doc(db, COLLECTIONS.workers, uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return;
  }

  await setDocument(
    COLLECTIONS.workers,
    uid,
    {
      uid,
      name: "New Worker",
      role: "worker",
      active: true
    },
    actorUid
  );
};

export const consumeInventoryItems = async (
  requests: Array<{ inventoryItemId: string; quantity: number }>,
  actorUid: string
): Promise<void> => {
  const normalized = requests.filter((entry) => entry.quantity > 0);
  if (normalized.length === 0) {
    return;
  }

  await runTransaction(db, async (transaction) => {
    for (const request of normalized) {
      const ref = doc(db, COLLECTIONS.inventory, request.inventoryItemId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        throw new Error("Selected inventory item does not exist.");
      }

      const item = snapshot.data() as InventoryItem;
      const currentQty = Number(item.quantity ?? 0);
      if (currentQty < request.quantity) {
        throw new Error(`Insufficient stock for ${item.name}.`);
      }

      transaction.update(ref, {
        quantity: currentQty - request.quantity,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
      });
    }
  });
};
