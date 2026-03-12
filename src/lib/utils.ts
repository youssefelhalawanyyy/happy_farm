import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatCurrency = (value: number, currency = "EGP"): string =>
  new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);

export const formatNumber = (value: number): string => new Intl.NumberFormat("en-EG").format(value);

export const toFixedNumber = (value: number, digits = 2): number =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;

export const isoToday = (): string => new Date().toISOString().slice(0, 10);

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const addDaysToIsoDate = (isoDate: string, days: number): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoToday();
  }
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const toMonthKey = (isoDate: string): string => {
  if (!isoDate) {
    return "";
  }
  return isoDate.slice(0, 7);
};

interface TimestampLike {
  toDate?: () => Date;
  seconds?: number;
}

const toValidIso = (date: Date): string => (Number.isNaN(date.getTime()) ? "" : date.toISOString());

export const toIsoDateTime = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return toValidIso(value);
  }

  if (typeof value === "number") {
    return toValidIso(new Date(value));
  }

  if (value && typeof value === "object") {
    const timestamp = value as TimestampLike;
    if (typeof timestamp.toDate === "function") {
      return toValidIso(timestamp.toDate());
    }
    if (typeof timestamp.seconds === "number") {
      return toValidIso(new Date(timestamp.seconds * 1000));
    }
  }

  return "";
};

export const compareDateTimeAsc = (a: unknown, b: unknown): number =>
  toIsoDateTime(a).localeCompare(toIsoDateTime(b));

export const compareDateTimeDesc = (a: unknown, b: unknown): number => compareDateTimeAsc(b, a);

export const formatTimeHHMM = (value: unknown): string => {
  const iso = toIsoDateTime(value);
  return iso.length >= 16 ? iso.slice(11, 16) : "--:--";
};

export const formatDateOnly = (value: unknown): string => {
  const iso = toIsoDateTime(value);
  return iso.length >= 10 ? iso.slice(0, 10) : "";
};

export const formatDateTimeLocal = (value: unknown): string => {
  const iso = toIsoDateTime(value);
  return iso ? new Date(iso).toLocaleString() : "-";
};
