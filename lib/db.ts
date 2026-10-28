import { MongoClient, type ClientSession, type Db, type ObjectId, type Binary } from "mongodb";
import type { Permission } from "./permissions";
import type {
  AccountType,
  AttendanceStatus,
  CategoryKind,
  Currency,
  ExtraCostKind,
  MovementType,
  PaymentMethod,
  ProductCategoryType,
  SaidaReason,
  StockDocStatus,
  StockDocType,
  VariantAttrs,
} from "./types";

// Nota: sem "server-only" aqui para que os scripts (seed/smoke) possam usar o mesmo código.
// Este ficheiro nunca é importado por componentes de cliente.

export type Who = { id: ObjectId; name: string };

// ── Organização ─────────────────────────────────────────────

export type StoreDoc = {
  _id: ObjectId;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  receiptFooter?: string;
  allowNegativeStock: boolean;
  requireOpenTill: boolean;
  cashAccountId?: ObjectId;
  bankAccountId?: ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SettingsDoc = {
  _id: "app";
  businessName: string;
  nif?: string;
  phone?: string;
  address?: string;
  receiptNote?: string;
  lateToleranceMin: number;
  lowStockDefault: number;
  ivaEnabled: boolean;
  ivaRate: number;
  updatedAt: Date;
};

// ── Pessoas ─────────────────────────────────────────────────

export type UserDoc = {
  _id: ObjectId;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  passwordHash?: string;
  pinHash?: string;
  isOwner: boolean;
  roleId: ObjectId | null;
  allStores: boolean;
  storeIds: ObjectId[];
  extraPermissions: Permission[];
  removedPermissions: Permission[];
  jobTitle?: string;
  notes?: string;
  active: boolean;
  sessionVersion: number;
  pinFailures?: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RoleDoc = {
  _id: ObjectId;
  name: string;
  description?: string;
  color: string;
  permissions: Permission[];
  maxDiscountPct: number;
  createdAt: Date;
  updatedAt: Date;
};

// ── Catálogo ────────────────────────────────────────────────

export type CategoryDoc = { _id: ObjectId; name: string; type: ProductCategoryType; order: number; createdAt: Date };

export type VariantDoc = {
  _id: ObjectId;
  sku: string;
  barcode?: string;
  label: string;
  price: number;
  storePrices: Record<string, number>;
  avgCost: number;
  lastCost?: number;
  minQty: number;
  attrs?: VariantAttrs;
  active: boolean;
};

export type ProductDoc = {
  _id: ObjectId;
  name: string;
  brand?: string;
  categoryId: ObjectId | null;
  description?: string;
  imageId?: ObjectId;
  hasVariants: boolean;
  variants: VariantDoc[];
  search: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ImageDoc = {
  _id: ObjectId;
  kind: "produto" | "recibo";
  data: Binary;
  contentType: string;
  width: number;
  height: number;
  size: number;
  createdBy: ObjectId;
  createdAt: Date;
};

// ── Stock ───────────────────────────────────────────────────

export type StockDoc = {
  _id: ObjectId;
  storeId: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  qty: number;
  updatedAt: Date;
};

export type MovementDoc = {
  _id: ObjectId;
  at: Date;
  storeId: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  qty: number;
  type: MovementType;
  unitCost: number;
  balanceAfter: number;
  ref: { kind: "venda" | "compra" | "doc" | "manual"; id?: ObjectId; number?: string };
  by: Who;
  note?: string;
};

export type DocLine = {
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  sku: string;
  qty: number;
  qtyReceived?: number;
  systemQty?: number;
  unitCost: number;
  note?: string;
};

export type StockDocDoc = {
  _id: ObjectId;
  number: string;
  type: StockDocType;
  storeId: ObjectId;
  toStoreId?: ObjectId;
  reason?: SaidaReason;
  status: StockDocStatus;
  lines: DocLine[];
  transportCost?: number;
  note?: string;
  createdBy: Who;
  createdAt: Date;
  receivedBy?: Who;
  receivedAt?: Date;
  receiveNote?: string;
  cancelledBy?: Who;
  cancelledAt?: Date;
};

// ── Compras ─────────────────────────────────────────────────

export type SupplierDoc = {
  _id: ObjectId;
  name: string;
  contact?: string;
  phone?: string;
  country?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
};

export type PurchaseLine = {
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  sku: string;
  qty: number;
  unitCostForeign: number;
  unitCostKz: number;
  landedUnitCost: number;
};

export type PurchasePayment = {
  _id: ObjectId;
  at: Date;
  amount: number;
  accountId: ObjectId;
  method: PaymentMethod;
  note?: string;
  by: Who;
};

export type PurchaseDoc = {
  _id: ObjectId;
  number: string;
  supplierId: ObjectId | null;
  supplierName: string;
  storeId: ObjectId;
  status: "rascunho" | "recebida" | "cancelada";
  currency: Currency;
  rate: number;
  lines: PurchaseLine[];
  extraCosts: { kind: ExtraCostKind; description?: string; amount: number }[];
  allocation: "valor" | "quantidade";
  goodsTotal: number;
  extraTotal: number;
  total: number;
  payments: PurchasePayment[];
  paid: number;
  invoiceRef?: string;
  note?: string;
  createdBy: Who;
  createdAt: Date;
  updatedAt: Date;
  receivedBy?: Who;
  receivedAt?: Date;
};

// ── Vendas ──────────────────────────────────────────────────

export type SaleLine = {
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  sku: string;
  qty: number;
  listPrice: number;
  unitPrice: number;
  lineTotal: number;
  unitCost: number;
  returnedQty: number;
};

export type SaleReturn = {
  at: Date;
  by: Who;
  lines: { variantId: ObjectId; qty: number; amount: number }[];
  amount: number;
  method: PaymentMethod;
  reason: string;
};

export type SaleDoc = {
  _id: ObjectId;
  number: string;
  storeId: ObjectId;
  tillId: ObjectId | null;
  seller: Who;
  customer?: { name?: string; phone?: string };
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  payments: { method: PaymentMethod; amount: number }[];
  cashReceived?: number;
  change: number;
  status: "concluida" | "anulada";
  returns: SaleReturn[];
  refunded: number;
  returnedCost: number;
  note?: string;
  clientRequestId: string;
  createdAt: Date;
  voidedAt?: Date;
  voidedBy?: Who;
  voidReason?: string;
};

export type TillDoc = {
  _id: ObjectId;
  storeId: ObjectId;
  status: "aberta" | "fechada";
  openedBy: Who;
  openedAt: Date;
  openingFloat: number;
  closedBy?: Who;
  closedAt?: Date;
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  summary?: { sales: number; count: number; byMethod: Record<string, number>; cashIn: number; cashOut: number };
  note?: string;
};

export type CustomerDoc = {
  _id: ObjectId;
  name?: string;
  phone: string;
  totalSpent: number;
  visits: number;
  lastPurchaseAt: Date;
  createdAt: Date;
};

// ── Dinheiro ────────────────────────────────────────────────

export type AccountDoc = {
  _id: ObjectId;
  name: string;
  type: AccountType;
  storeId: ObjectId | null;
  openingBalance: number;
  active: boolean;
  createdAt: Date;
};

export type FinCategoryDoc = {
  _id: ObjectId;
  name: string;
  type: "entrada" | "saida";
  kind: CategoryKind;
  key?: string;
  active: boolean;
  createdAt: Date;
};

export type CashEntryDoc = {
  _id: ObjectId;
  type: "entrada" | "saida";
  amount: number;
  at: Date;
  day: string;
  category: { id: ObjectId; name: string; kind: CategoryKind };
  accountId: ObjectId;
  storeId: ObjectId | null;
  method?: PaymentMethod;
  description: string;
  source: "manual" | "venda" | "anulacao" | "devolucao" | "compra" | "contas" | "caixa" | "transferencia";
  ref?: { id: ObjectId; number: string };
  transferId?: ObjectId;
  attachmentId?: ObjectId;
  voided?: { at: Date; by: Who; reason: string };
  by: Who;
  createdAt: Date;
};

// ── RH ──────────────────────────────────────────────────────

export type ShiftDoc = {
  _id: ObjectId;
  userId: ObjectId;
  storeId: ObjectId;
  day: string;
  start: string;
  end: string;
  note?: string;
  createdBy: Who;
  createdAt: Date;
};

export type TemplateDoc = {
  _id: ObjectId;
  storeId: ObjectId;
  days: ({ start: string; end: string } | null)[];
  updatedAt: Date;
};

export type AttendanceDoc = {
  _id: ObjectId;
  userId: ObjectId;
  userName: string;
  storeId: ObjectId;
  day: string;
  status: AttendanceStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  checkIn?: Date;
  checkOut?: Date;
  lateMinutes?: number;
  note?: string;
  confirmedBy: Who;
  confirmedAt: Date;
  history: { at: Date; by: Who; change: string }[];
};

// ── Sistema ─────────────────────────────────────────────────

export type AuditDoc = {
  _id: ObjectId;
  at: Date;
  by: Who;
  action: string;
  entity: string;
  entityId?: ObjectId;
  storeId?: ObjectId | null;
  summary: string;
};

export type CounterDoc = { _id: string; seq: number };

// ── Ligação ─────────────────────────────────────────────────

const g = globalThis as typeof globalThis & { _csMongo?: Promise<MongoClient> };

export function dbName() {
  return process.env.MONGODB_DB || "CreativeSociety";
}

async function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI em falta no ficheiro .env");
  const client = await new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 }).connect();
  await ensureIndexes(client.db(dbName()));
  return client;
}

export async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    db.collection("users").createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } }),
    db.collection("users").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } }),
    db.collection("stores").createIndex({ code: 1 }, { unique: true }),
    db.collection("products").createIndex({ "variants.sku": 1 }),
    db.collection("products").createIndex({ "variants.barcode": 1 }),
    db.collection("products").createIndex({ search: 1 }),
    db.collection("stock").createIndex({ storeId: 1, variantId: 1 }, { unique: true }),
    db.collection("stock").createIndex({ variantId: 1 }),
    db.collection("movements").createIndex({ storeId: 1, at: -1 }),
    db.collection("movements").createIndex({ variantId: 1, at: -1 }),
    db.collection("movements").createIndex({ type: 1, at: -1 }),
    db.collection("stockDocs").createIndex({ number: 1 }, { unique: true }),
    db.collection("stockDocs").createIndex({ type: 1, createdAt: -1 }),
    db.collection("stockDocs").createIndex({ toStoreId: 1, status: 1 }),
    db.collection("purchases").createIndex({ number: 1 }, { unique: true }),
    db.collection("purchases").createIndex({ createdAt: -1 }),
    db.collection("sales").createIndex({ number: 1 }, { unique: true }),
    db.collection("sales").createIndex({ clientRequestId: 1 }, { unique: true }),
    db.collection("sales").createIndex({ storeId: 1, createdAt: -1 }),
    db.collection("sales").createIndex({ "seller.id": 1, createdAt: -1 }),
    db.collection("sales").createIndex({ createdAt: -1 }),
    db.collection("tills").createIndex({ storeId: 1 }, { unique: true, partialFilterExpression: { status: "aberta" }, name: "one_open_till_per_store" }),
    db.collection("tills").createIndex({ storeId: 1, openedAt: -1 }),
    db.collection("customers").createIndex({ phone: 1 }, { unique: true }),
    db.collection("cashbook").createIndex({ at: -1 }),
    db.collection("cashbook").createIndex({ accountId: 1, at: -1 }),
    db.collection("cashbook").createIndex({ storeId: 1, at: -1 }),
    db.collection("finCategories").createIndex({ key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } }),
    db.collection("shifts").createIndex({ userId: 1, day: 1 }, { unique: true }),
    db.collection("shifts").createIndex({ storeId: 1, day: 1 }),
    db.collection("attendance").createIndex({ userId: 1, day: 1 }, { unique: true }),
    db.collection("attendance").createIndex({ storeId: 1, day: 1 }),
    db.collection("audit").createIndex({ at: -1 }),
    db.collection("audit").createIndex({ "by.id": 1, at: -1 }),
    db.collection("ratelimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export function getClient(): Promise<MongoClient> {
  if (!g._csMongo) {
    g._csMongo = connect().catch((err) => {
      g._csMongo = undefined; // tenta de novo no próximo pedido
      throw err;
    });
  }
  return g._csMongo;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(dbName());
}

/** Corre `fn` numa transação (com repetição automática em conflitos) */
export async function withTx<T>(fn: (db: Db, session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getClient();
  const db = client.db(dbName());
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await fn(db, session);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
    return result as T;
  } finally {
    await session.endSession();
  }
}

export const col = {
  stores: (db: Db) => db.collection<StoreDoc>("stores"),
  settings: (db: Db) => db.collection<SettingsDoc>("settings"),
  users: (db: Db) => db.collection<UserDoc>("users"),
  roles: (db: Db) => db.collection<RoleDoc>("roles"),
  categories: (db: Db) => db.collection<CategoryDoc>("categories"),
  products: (db: Db) => db.collection<ProductDoc>("products"),
  images: (db: Db) => db.collection<ImageDoc>("images"),
  stock: (db: Db) => db.collection<StockDoc>("stock"),
  movements: (db: Db) => db.collection<MovementDoc>("movements"),
  stockDocs: (db: Db) => db.collection<StockDocDoc>("stockDocs"),
  suppliers: (db: Db) => db.collection<SupplierDoc>("suppliers"),
  purchases: (db: Db) => db.collection<PurchaseDoc>("purchases"),
  sales: (db: Db) => db.collection<SaleDoc>("sales"),
  tills: (db: Db) => db.collection<TillDoc>("tills"),
  customers: (db: Db) => db.collection<CustomerDoc>("customers"),
  accounts: (db: Db) => db.collection<AccountDoc>("accounts"),
  finCategories: (db: Db) => db.collection<FinCategoryDoc>("finCategories"),
  cashbook: (db: Db) => db.collection<CashEntryDoc>("cashbook"),
  shifts: (db: Db) => db.collection<ShiftDoc>("shifts"),
  templates: (db: Db) => db.collection<TemplateDoc>("templates"),
  attendance: (db: Db) => db.collection<AttendanceDoc>("attendance"),
  audit: (db: Db) => db.collection<AuditDoc>("audit"),
  counters: (db: Db) => db.collection<CounterDoc>("counters"),
};

export const DEFAULT_SETTINGS: Omit<SettingsDoc, "_id" | "updatedAt"> = {
  businessName: "Creative Society",
  receiptNote: "Obrigado pela preferência!",
  lateToleranceMin: 10,
  lowStockDefault: 2,
  ivaEnabled: false,
  ivaRate: 14,
};

export async function getSettings(db: Db): Promise<SettingsDoc> {
  const s = await col.settings(db).findOne({ _id: "app" });
  return { _id: "app", updatedAt: new Date(0), ...DEFAULT_SETTINGS, ...(s ?? {}) };
}
