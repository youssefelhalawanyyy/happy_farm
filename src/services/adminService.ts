import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { createDocument } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";
import type { MarketPriceSnapshot, UserRole } from "@/types";

interface CreateUserPayload {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  assignedHouse?: string;
}

export const createUserAccount = async (payload: CreateUserPayload): Promise<{ uid: string }> => {
  const fn = httpsCallable<CreateUserPayload, { uid: string }>(functions, "createUserAccount");
  const result = await fn(payload);
  return result.data;
};

export const updateUserAccount = async (payload: {
  uid: string;
  role?: UserRole;
  disabled?: boolean;
  assignedHouse?: string;
}): Promise<{ ok: boolean }> => {
  const fn = httpsCallable<typeof payload, { ok: boolean }>(functions, "updateUserAccount");
  const result = await fn(payload);
  return result.data;
};

export const generatePasswordResetLink = async (email: string): Promise<{ link: string }> => {
  const fn = httpsCallable<{ email: string }, { link: string }>(functions, "generatePasswordResetLink");
  const result = await fn({ email });
  return result.data;
};

const isHttpUrl = (value: string | undefined): boolean => Boolean(value && /^https?:\/\//i.test(value));

const configuredProviderUrl =
  (import.meta.env.VITE_MARKET_PRICE_PROVIDER_URL as string | undefined) ??
  (import.meta.env.VITE_MARKET_SOURCE_URL as string | undefined);

const resolveSnapshotSourceUrl = (latest?: MarketPriceSnapshot): string | undefined => {
  if (isHttpUrl(latest?.sourceUrl)) {
    return latest?.sourceUrl;
  }
  if (isHttpUrl(latest?.source)) {
    return latest?.source;
  }
  if (isHttpUrl(configuredProviderUrl)) {
    return configuredProviderUrl;
  }
  return undefined;
};

const fallbackSnapshot = (latest?: MarketPriceSnapshot): MarketPriceSnapshot => {
  const sourceUrl = resolveSnapshotSourceUrl(latest);

  return {
    feedPricePerTon: latest?.feedPricePerTon && latest.feedPricePerTon > 0 ? latest.feedPricePerTon : 16500,
    dayOldChickPrice: latest?.dayOldChickPrice && latest.dayOldChickPrice > 0 ? latest.dayOldChickPrice : 17,
    liveBroilerPricePerKg: latest?.liveBroilerPricePerKg && latest.liveBroilerPricePerKg > 0 ? latest.liveBroilerPricePerKg : 93,
    cornPricePerTon: latest?.cornPricePerTon && latest.cornPricePerTon > 0 ? latest.cornPricePerTon : 12000,
    soybeanMealPricePerTon:
      latest?.soybeanMealPricePerTon && latest.soybeanMealPricePerTon > 0 ? latest.soybeanMealPricePerTon : 18800,
    source: "client-manual-fallback",
    ...(sourceUrl ? { sourceUrl } : {}),
    capturedAt: new Date().toISOString()
  };
};

export const triggerMarketSync = async (
  actorUid?: string,
  latest?: MarketPriceSnapshot
): Promise<{ savedId: string; source: "cloud-function" | "client-fallback" }> => {
  try {
    const fn = httpsCallable<Record<string, never>, { savedId: string }>(functions, "manualMarketPriceSync");
    const result = await fn({});
    return { ...result.data, source: "cloud-function" };
  } catch {
    const fallbackActorUid = actorUid ?? auth.currentUser?.uid;
    if (!fallbackActorUid) {
      throw new Error("Market sync failed and no signed-in user is available for fallback save.");
    }

    const savedId = await createDocument<MarketPriceSnapshot>(
      COLLECTIONS.marketPrices,
      fallbackSnapshot(latest),
      fallbackActorUid
    );
    return { savedId, source: "client-fallback" };
  }
};
