import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { CallableRequest } from "firebase-functions/v2/https";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

const region = "us-central1";

interface MarketPriceSnapshot {
  feedPricePerTon: number;
  dayOldChickPrice: number;
  liveBroilerPricePerKg: number;
  cornPricePerTon: number;
  soybeanMealPricePerTon: number;
  source: string;
  sourceUrl?: string;
  capturedAt: string;
}

interface UserClaims {
  role?: string;
}

const assertAdmin = async (request: CallableRequest<unknown>): Promise<void> => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const profile = await db.collection("users").doc(uid).get();
  const role = profile.data()?.role;

  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
};

const assertManagerOrAdmin = async (request: CallableRequest<unknown>): Promise<void> => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const profile = await db.collection("users").doc(uid).get();
  const role = profile.data()?.role;

  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Manager or admin role required.");
  }
};

const numberFromUnknown = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeSnapshot = (
  payload: Partial<MarketPriceSnapshot>,
  source: string,
  sourceUrl?: string
): MarketPriceSnapshot => ({
  feedPricePerTon: numberFromUnknown(payload.feedPricePerTon),
  dayOldChickPrice: numberFromUnknown(payload.dayOldChickPrice),
  liveBroilerPricePerKg: numberFromUnknown(payload.liveBroilerPricePerKg),
  cornPricePerTon: numberFromUnknown(payload.cornPricePerTon),
  soybeanMealPricePerTon: numberFromUnknown(payload.soybeanMealPricePerTon),
  source,
  ...(sourceUrl ? { sourceUrl } : {}),
  capturedAt: new Date().toISOString()
});

const fetchConfiguredMarketSnapshot = async (): Promise<MarketPriceSnapshot> => {
  const providerUrl = process.env.MARKET_PRICE_PROVIDER_URL;

  if (!providerUrl) {
    throw new Error("MARKET_PRICE_PROVIDER_URL is not configured.");
  }

  const response = await fetch(providerUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Market provider returned ${response.status}`);
  }

  const payload = (await response.json()) as Partial<MarketPriceSnapshot>;
  return sanitizeSnapshot(payload, "configured-provider", providerUrl);
};

const fallbackToLastSnapshot = async (): Promise<MarketPriceSnapshot> => {
  const snapshot = await db.collection("marketPrices").orderBy("capturedAt", "desc").limit(1).get();
  const row = snapshot.docs[0]?.data() as MarketPriceSnapshot | undefined;

  if (!row) {
    return {
      feedPricePerTon: 0,
      dayOldChickPrice: 0,
      liveBroilerPricePerKg: 0,
      cornPricePerTon: 0,
      soybeanMealPricePerTon: 0,
      source: "bootstrap-default",
      capturedAt: new Date().toISOString()
    };
  }

  return {
    ...row,
    source: "fallback-last-known",
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    capturedAt: new Date().toISOString()
  };
};

const syncMarketPrices = async (): Promise<string> => {
  let snapshot: MarketPriceSnapshot;

  try {
    snapshot = await fetchConfiguredMarketSnapshot();
  } catch (error) {
    logger.error("Configured provider failed. Falling back to last snapshot.", error);
    snapshot = await fallbackToLastSnapshot();
  }

  const ref = await db.collection("marketPrices").add({
    ...snapshot,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return ref.id;
};

export const createUserAccount = onCall({ region }, async (request) => {
  await assertAdmin(request);

  const payload = request.data as {
    email: string;
    password: string;
    displayName: string;
    role: "admin" | "manager" | "worker";
    assignedHouse?: string;
  };

  if (!payload.email || !payload.password || !payload.displayName || !payload.role) {
    throw new HttpsError("invalid-argument", "Missing required user fields.");
  }

  const userRecord = await auth.createUser({
    email: payload.email,
    password: payload.password,
    displayName: payload.displayName,
    disabled: false
  });

  await auth.setCustomUserClaims(userRecord.uid, { role: payload.role } satisfies UserClaims);

  await db.collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
    assignedHouse: payload.assignedHouse ?? "",
    disabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { uid: userRecord.uid };
});

export const updateUserAccount = onCall({ region }, async (request) => {
  await assertAdmin(request);

  const payload = request.data as {
    uid: string;
    role?: "admin" | "manager" | "worker";
    disabled?: boolean;
    assignedHouse?: string;
  };

  if (!payload.uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  if (payload.role) {
    await auth.setCustomUserClaims(payload.uid, { role: payload.role } satisfies UserClaims);
  }

  if (typeof payload.disabled === "boolean") {
    await auth.updateUser(payload.uid, { disabled: payload.disabled });
  }

  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (payload.role) updates.role = payload.role;
  if (typeof payload.disabled === "boolean") updates.disabled = payload.disabled;
  if (typeof payload.assignedHouse === "string") updates.assignedHouse = payload.assignedHouse;

  await db.collection("users").doc(payload.uid).set(updates, { merge: true });

  return { ok: true };
});

export const generatePasswordResetLink = onCall({ region }, async (request) => {
  await assertAdmin(request);

  const payload = request.data as { email: string };
  if (!payload.email) {
    throw new HttpsError("invalid-argument", "email is required");
  }

  const link = await auth.generatePasswordResetLink(payload.email);
  return { link };
});

export const manualMarketPriceSync = onCall({ region, secrets: ["MARKET_PRICE_PROVIDER_URL"] }, async (request) => {
  await assertManagerOrAdmin(request);
  const savedId = await syncMarketPrices();
  return { savedId };
});

export const scheduledMarketPriceSync = onSchedule(
  {
    region,
    schedule: "every 10 minutes",
    timeZone: "Africa/Cairo",
    secrets: ["MARKET_PRICE_PROVIDER_URL"]
  },
  async () => {
    const savedId = await syncMarketPrices();
    logger.info("Market snapshot saved", { savedId });
  }
);

export const ingestEnvironmentReading = onRequest({ region, secrets: ["ESP32_API_KEY"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const configuredApiKey = process.env.ESP32_API_KEY;
  if (configuredApiKey) {
    const sentApiKey = req.headers["x-api-key"];
    if (sentApiKey !== configuredApiKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const payload = req.body as {
    houseId: string;
    deviceId: string;
    temperatureC: number;
    humidity: number;
    ammoniaPpm: number;
    fanStatus: boolean;
    heaterStatus: boolean;
    recordedAt?: string;
  };

  if (!payload.houseId || !payload.deviceId) {
    res.status(400).json({ error: "houseId and deviceId are required" });
    return;
  }

  const reading = {
    ...payload,
    temperatureC: numberFromUnknown(payload.temperatureC),
    humidity: numberFromUnknown(payload.humidity),
    ammoniaPpm: numberFromUnknown(payload.ammoniaPpm),
    fanStatus: Boolean(payload.fanStatus),
    heaterStatus: Boolean(payload.heaterStatus),
    recordedAt: payload.recordedAt ?? new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "esp32-http"
  };

  const ref = await db.collection("environmentReadings").add(reading);

  const alerts: Array<{ title: string; message: string; severity: "low" | "medium" | "high" }> = [];

  if (reading.temperatureC > 33 || reading.temperatureC < 25) {
    alerts.push({
      title: "Temperature out of range",
      message: `${reading.houseId} temperature is ${reading.temperatureC}°C`,
      severity: "high"
    });
  }

  if (reading.ammoniaPpm > 25) {
    alerts.push({
      title: "Ammonia level warning",
      message: `${reading.houseId} ammonia reached ${reading.ammoniaPpm} ppm`,
      severity: "medium"
    });
  }

  await Promise.all(
    alerts.map((alert) =>
      db.collection("alerts").add({
        title: alert.title,
        message: alert.message,
        type: "temperature",
        severity: alert.severity,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "esp32-monitor"
      })
    )
  );

  res.status(200).json({ ok: true, id: ref.id, alerts: alerts.length });
});

export const pushAlertNotifications = onDocumentCreated(
  {
    region,
    document: "alerts/{alertId}"
  },
  async (event) => {
    const data = event.data?.data() as {
      title?: string;
      message?: string;
      severity?: string;
      type?: string;
    };

    if (!data) {
      return;
    }

    const notification = {
      title: `[${data.severity ?? "info"}] ${data.title ?? "Farm Alert"}`,
      body: data.message ?? "Farm alert triggered"
    };

    try {
      await messaging.send({
        topic: "farm-alerts",
        notification
      });

      const tokensSnapshot = await db.collection("notificationTokens").get();
      const tokens = tokensSnapshot.docs.map((doc) => doc.data().token as string).filter(Boolean);

      if (tokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens,
          notification,
          data: {
            type: data.type ?? "alert"
          }
        });
      }
    } catch (error) {
      logger.error("Failed to send push alert", error);
    }
  }
);
