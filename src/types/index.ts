import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "manager" | "worker";

export type FeedType = "starter" | "grower" | "finisher";
export type BreedType = "ross" | "cobb" | "hubbard";
export type ExpenseCategory =
  | "utilities"
  | "payment"
  | "maintenance"
  | "fuel"
  | "rent"
  | "insurance"
  | "feed"
  | "chicks"
  | "medicine"
  | "labor"
  | "electricity"
  | "transport"
  | "other";

export type InventoryCategory = "feed" | "medicine" | "vaccines" | "equipment" | "supplies" | "livestock";

export interface AuditFields {
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserProfile extends AuditFields {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  disabled: boolean;
  assignedHouse?: string;
  phone?: string;
}

export interface Batch extends AuditFields {
  id?: string;
  batchId: string;
  arrivalDate: string;
  chickAgeAtArrivalDays?: number;
  supplierHatchery: string;
  chickPrice: number;
  initialChickCount: number;
  currentAliveCount: number;
  mortalityCount: number;
  breed: BreedType;
  assignedHouse: string;
  targetSellingWeight: number;
  expectedSellingDate: string;
  batchCost?: number;
  status: "active" | "sold" | "closed";
}

export interface FeedRecord extends AuditFields {
  id?: string;
  batchId: string;
  type: FeedType;
  quantityKg: number;
  supplier: string;
  pricePerTon: number;
  recordDate: string;
  notes?: string;
}

export interface GrowthRecord extends AuditFields {
  id?: string;
  batchId: string;
  recordDate: string;
  averageWeightKg: number;
  sampleSize: number;
}

export interface MortalityRecord extends AuditFields {
  id?: string;
  batchId: string;
  recordDate: string;
  birds: number;
  cause?: string;
}

export type LivestockAdjustmentReason = "dead_loss" | "manual_correction";

export interface LivestockAdjustmentRecord extends AuditFields {
  id?: string;
  quantity: number;
  delta: number;
  reason: LivestockAdjustmentReason;
  batchId?: string;
  note?: string;
  stockBefore: number;
  stockAfter: number;
  adjustedAt: string;
}

export interface EnvironmentReading extends AuditFields {
  id?: string;
  houseId: string;
  deviceId: string;
  temperatureC: number;
  humidity: number;
  ammoniaPpm: number;
  fanStatus: boolean;
  heaterStatus: boolean;
  recordedAt: string;
}

export interface MarketPriceSnapshot extends AuditFields {
  id?: string;
  feedPricePerTon: number;
  dayOldChickPrice: number;
  liveBroilerPricePerKg: number;
  cornPricePerTon: number;
  soybeanMealPricePerTon: number;
  source: string;
  sourceUrl?: string;
  capturedAt: string;
}

export interface SaleRecord extends AuditFields {
  id?: string;
  buyerName: string;
  batchId: string;
  birdCount: number;
  averageWeightKg: number;
  pricePerKg: number;
  totalRevenue: number;
  saleDate: string;
}

export interface ExpenseRecord extends AuditFields {
  id?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  batchId?: string;
}

export interface InventoryItem extends AuditFields {
  id?: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  reorderLevel: number;
  supplier?: string;
  lastRestockedAt?: string;
}

export interface WorkerTask extends AuditFields {
  id?: string;
  title: string;
  description?: string;
  assignedToUid: string;
  assignedHouse?: string;
  dueDate: string;
  status: "todo" | "in_progress" | "done";
}

export interface WorkerProfile extends AuditFields {
  id?: string;
  uid: string;
  name: string;
  role: UserRole;
  assignedHouse?: string;
  contact?: string;
  active: boolean;
}

export interface QuotationItem {
  item: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source?: "inventory" | "other";
  inventoryItemId?: string;
}

export type QuotationPaymentStatus = "unpaid" | "paid";

export interface Quotation extends AuditFields {
  id?: string;
  quotationNumber: string;
  quotationType: "chicken_sales" | "farm_supplies" | "equipment";
  customerName: string;
  customerContact?: string;
  validUntil: string;
  items: QuotationItem[];
  subtotal: number;
  discountPercent?: number;
  taxPercent?: number;
  discountAmount?: number;
  taxAmount?: number;
  discount: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  paymentStatus?: QuotationPaymentStatus;
  paidAmount?: number;
  paidAt?: string;
}

export interface Alert extends AuditFields {
  id?: string;
  title: string;
  message: string;
  type: "mortality" | "feed" | "temperature" | "market" | "inventory";
  severity: "low" | "medium" | "high";
  read: boolean;
  batchId?: string;
}

export interface DashboardMetrics {
  totalChickens: number;
  activeBatches: number;
  mortalityToday: number;
  feedInventoryKg: number;
  liveMarketPrice: number;
  currentTemperature: number;
  estimatedProfit: number;
}

/* ─── Vaccination & Medication ─────────────────────────────────────────── */

export type VaccinationRoute = "drinking_water" | "spray" | "eye_drop" | "injection" | "in_ovo";

export interface VaccinationProtocolItem {
  dayOfAge: number;
  diseaseName: string;
  vaccine: string;
  route: VaccinationRoute;
  notes?: string;
}

export const STANDARD_BROILER_PROTOCOL: VaccinationProtocolItem[] = [
  { dayOfAge: 1,  diseaseName: "Marek's Disease",                 vaccine: "HVT / Rispens",      route: "injection",      notes: "Administered at hatchery" },
  { dayOfAge: 7,  diseaseName: "Newcastle Disease (NDV)",         vaccine: "Lasota / Clone 30",  route: "drinking_water" },
  { dayOfAge: 14, diseaseName: "Infectious Bursal Disease (IBD)", vaccine: "Intermediate IBD",   route: "drinking_water", notes: "Gumboro – critical window" },
  { dayOfAge: 21, diseaseName: "Newcastle Disease (Booster)",     vaccine: "Lasota",             route: "drinking_water" },
  { dayOfAge: 28, diseaseName: "Infectious Bronchitis (IB)",      vaccine: "IB Ma5 / H120",      route: "spray",          notes: "Optional – assess risk" },
];

export interface VaccinationScheduleEntry extends AuditFields {
  id?: string;
  batchId: string;
  dayOfAge: number;
  diseaseName: string;
  vaccine: string;
  route: VaccinationRoute;
  scheduledDate: string;
  status: "pending" | "done" | "skipped";
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

/* ─── Batch Comparison ─────────────────────────────────────────────────── */

export interface BatchPerformanceSummary {
  batchId: string;
  batchLabel: string;
  breed: BreedType;
  supplier: string;
  arrivalDate: string;
  daysInProduction: number;
  initialCount: number;
  mortalityCount: number;
  mortalityPct: number;
  survivalPct: number;
  fcr: number;
  avgWeightKg: number;
  feedKg: number;
  totalRevenue: number;
  totalCost: number;
  profitEGP: number;
  profitPerKg: number;
  status: "active" | "sold" | "closed";
}
