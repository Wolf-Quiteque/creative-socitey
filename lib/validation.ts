import { z } from "zod";
import { PAYMENT_METHOD_KEYS, SAIDA_REASONS, CURRENCIES, EXTRA_COST_KINDS, CATEGORY_TYPES, HAIR_TYPES, ACCOUNT_TYPES, CATEGORY_KINDS } from "./types";
import { isPermission } from "./permissions";

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const zId = z.string().regex(/^[a-f0-9]{24}$/i, "Identificador inválido.");
export const zOptId = z.union([zId, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
export const zText = (max = 200) => z.string().trim().max(max, `Texto demasiado longo (máx. ${max}).`);
export const zName = (label = "O nome") => z.string().trim().min(1, `${label} é obrigatório.`).max(120, `${label} é demasiado longo.`);
export const zOptText = (max = 500) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
export const zKz = (label = "O valor") =>
  z.number({ message: `${label} tem de ser um número.` }).finite().min(0, `${label} não pode ser negativo.`).max(1e12, `${label} é demasiado alto.`);
export const zPosKz = (label = "O valor") => zKz(label).refine((v) => v > 0, `${label} tem de ser maior que zero.`);
export const zQty = z.number({ message: "Quantidade inválida." }).int("A quantidade tem de ser um número inteiro.").min(1, "A quantidade tem de ser pelo menos 1.").max(100000);
export const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
export const zHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:MM).");
export const zMethod = z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]).transform((v) => v as (typeof PAYMENT_METHOD_KEYS)[number]);
export const zPerms = z.array(z.string()).transform((list) => [...new Set(list.filter(isPermission))]);

// ── Pessoas ─────────────────────────────────────────────────

export const zPin = z.string().regex(/^\d{4,6}$/, "O PIN tem de ter 4 a 6 algarismos.");

export const userSchema = z.object({
  name: zName(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "O utilizador deve ter 3 a 30 caracteres: letras, números, ponto, hífen ou _."),
  phone: z
    .string()
    .optional()
    .transform((v) => {
      const d = (v ?? "").replace(/\D/g, "").replace(/^244(?=9\d{8}$)/, "");
      return d || undefined;
    })
    .refine((v) => !v || /^9\d{8}$/.test(v), "Telefone inválido (9 algarismos, a começar por 9)."),
  roleId: zOptId,
  allStores: z.boolean(),
  storeIds: z.array(zId).max(100),
  extraPermissions: zPerms,
  removedPermissions: zPerms,
  jobTitle: zOptText(80),
  notes: zOptText(1000),
  pin: z.union([zPin, z.literal("")]).optional(),
});
export type UserInput = z.input<typeof userSchema>;

export const roleSchema = z.object({
  name: zName(),
  description: zOptText(300),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Cor inválida."),
  permissions: zPerms,
  maxDiscountPct: z.number().min(0).max(100),
});
export type RoleInput = z.input<typeof roleSchema>;

// ── Lojas e definições ──────────────────────────────────────

export const storeSchema = z.object({
  name: zName(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,5}$/, "O código deve ter 2 a 5 letras ou números (ex.: TAL)."),
  address: zOptText(200),
  city: zOptText(80),
  phone: zOptText(40),
  receiptFooter: zOptText(300),
  allowNegativeStock: z.boolean(),
  requireOpenTill: z.boolean(),
  bankAccountId: zOptId,
  active: z.boolean(),
});
export type StoreInput = z.input<typeof storeSchema>;

export const settingsSchema = z.object({
  businessName: zName("O nome da empresa"),
  nif: zOptText(30),
  phone: zOptText(40),
  address: zOptText(200),
  receiptNote: zOptText(300),
  lateToleranceMin: z.number().int().min(0).max(240),
  lowStockDefault: z.number().int().min(0).max(1000),
  ivaEnabled: z.boolean(),
  ivaRate: z.number().min(0).max(100),
});
export type SettingsInput = z.input<typeof settingsSchema>;

// ── Catálogo ────────────────────────────────────────────────

export const categorySchema = z.object({ name: zName(), type: z.enum(keys(CATEGORY_TYPES)) });

const attrsSchema = z
  .object({
    hairType: z.enum(keys(HAIR_TYPES)).optional(),
    texture: zOptText(60),
    lengthIn: z.number().int().min(1).max(60).optional(),
    color: zOptText(60),
    lace: zOptText(60),
    density: zOptText(20),
  })
  .optional();

export const variantSchema = z.object({
  id: zOptId,
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{1,40}$/, "SKU inválido: use letras, números, ponto ou hífen."),
  barcode: zOptText(40),
  label: zText(80).default(""),
  price: zKz("O preço"),
  storePrices: z.record(zId, zKz("O preço da loja")).default({}),
  cost: zKz("O custo").optional(),
  minQty: z.number().int().min(0).max(100000).default(0),
  attrs: attrsSchema,
  active: z.boolean().default(true),
  initialStock: z.array(z.object({ storeId: zId, qty: z.number().int().min(0).max(100000) })).default([]),
});

export const productSchema = z.object({
  name: zName(),
  brand: zOptText(80),
  categoryId: zOptId,
  description: zOptText(2000),
  imageId: zOptId,
  hasVariants: z.boolean(),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "Adicione pelo menos uma variante.").max(200),
});
export type ProductInput = z.input<typeof productSchema>;

// ── Stock ───────────────────────────────────────────────────

const docLine = z.object({ variantId: zId, qty: zQty, note: zOptText(200) });

export const saidaSchema = z.object({
  storeId: zId,
  reason: z.enum(keys(SAIDA_REASONS)),
  lines: z.array(docLine).min(1, "Adicione pelo menos um artigo.").max(300),
  note: zOptText(500),
});
export type SaidaInput = z.input<typeof saidaSchema>;

export const transferSchema = z.object({
  fromStoreId: zId,
  toStoreId: zId,
  lines: z.array(docLine).min(1, "Adicione pelo menos um artigo.").max(300),
  transportCost: zKz("O custo de transporte").default(0),
  transportAccountId: zOptId,
  note: zOptText(500),
});
export type TransferInput = z.input<typeof transferSchema>;

export const receiveSchema = z.object({
  docId: zId,
  lines: z.array(z.object({ variantId: zId, qtyReceived: z.number().int().min(0).max(100000), note: zOptText(200) })),
  note: zOptText(500),
});
export type ReceiveInput = z.input<typeof receiveSchema>;

export const adjustSchema = z.object({
  storeId: zId,
  lines: z.array(z.object({ variantId: zId, counted: z.number().int().min(0).max(1000000) })).min(1, "Conte pelo menos um artigo.").max(2000),
  note: zOptText(500),
});
export type AdjustInput = z.input<typeof adjustSchema>;

// ── Compras ─────────────────────────────────────────────────

export const supplierSchema = z.object({
  name: zName(),
  contact: zOptText(80),
  phone: zOptText(40),
  country: zOptText(60),
  notes: zOptText(1000),
  active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export const purchaseSchema = z.object({
  supplierId: zOptId,
  storeId: zId,
  currency: z.enum(keys(CURRENCIES)),
  rate: z.number().positive("A taxa de câmbio tem de ser maior que zero.").max(1e7),
  lines: z
    .array(z.object({ variantId: zId, qty: zQty, unitCostForeign: zKz("O custo unitário") }))
    .min(1, "Adicione pelo menos um artigo.")
    .max(500),
  extraCosts: z.array(z.object({ kind: z.enum(keys(EXTRA_COST_KINDS)), description: zOptText(120), amount: zKz("O custo extra") })).max(30),
  allocation: z.enum(["valor", "quantidade"]),
  invoiceRef: zOptText(60),
  note: zOptText(1000),
});
export type PurchaseInput = z.input<typeof purchaseSchema>;

export const paymentSchema = z.object({ amount: zPosKz("O valor"), accountId: zId, method: zMethod, note: zOptText(200) });

// ── Vendas ──────────────────────────────────────────────────

export const saleSchema = z.object({
  storeId: zId,
  clientRequestId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/, "Pedido inválido."),
  lines: z
    .array(z.object({ variantId: zId, qty: zQty, unitPrice: zKz("O preço").optional() }))
    .min(1, "O carrinho está vazio.")
    .max(200),
  discount: z.object({ type: z.enum(["pct", "kz"]), value: z.number().min(0) }).default({ type: "kz", value: 0 }),
  payments: z.array(z.object({ method: zMethod, amount: zKz("O pagamento") })).max(6),
  customer: z
    .object({ name: zOptText(80), phone: zOptText(30) })
    .optional()
    .transform((c) => {
      const phone = (c?.phone ?? "").replace(/\D/g, "").replace(/^244(?=9\d{8}$)/, "");
      return c && (c.name || phone) ? { name: c.name, phone: phone || undefined } : undefined;
    }),
  note: zOptText(300),
});
export type SaleInput = z.input<typeof saleSchema>;

export const returnSchema = z.object({
  saleId: zId,
  lines: z.array(z.object({ variantId: zId, qty: zQty })).min(1, "Escolha o que foi devolvido."),
  method: zMethod,
  reason: zName("O motivo"),
});
export type ReturnInput = z.input<typeof returnSchema>;

// ── Dinheiro ────────────────────────────────────────────────

export const entrySchema = z.object({
  type: z.enum(["entrada", "saida"]),
  amount: zPosKz("O valor"),
  categoryId: zId,
  accountId: zId,
  method: zMethod.optional(),
  description: zName("A descrição"),
  day: zDay.optional(),
  attachmentId: zOptId,
});
export type EntryInput = z.input<typeof entrySchema>;

export const accountTransferSchema = z.object({
  fromId: zId,
  toId: zId,
  amount: zPosKz("O valor"),
  description: zOptText(200),
  day: zDay.optional(),
});

export const accountSchema = z.object({
  name: zName(),
  type: z.enum(keys(ACCOUNT_TYPES)),
  storeId: zOptId,
  openingBalance: z.number().finite(),
  active: z.boolean(),
});
export type AccountInput = z.input<typeof accountSchema>;

export const finCategorySchema = z.object({
  name: zName(),
  type: z.enum(["entrada", "saida"]),
  kind: z.enum(keys(CATEGORY_KINDS)),
  active: z.boolean(),
});
export type FinCategoryInput = z.input<typeof finCategorySchema>;

// ── RH ──────────────────────────────────────────────────────

export const shiftSchema = z.object({
  userId: zId,
  storeId: zId,
  day: zDay,
  start: zHHMM,
  end: zHHMM,
  note: zOptText(200),
});
export type ShiftInput = z.input<typeof shiftSchema>;

export const templateSchema = z.object({
  userId: zId,
  storeId: zId,
  days: z.array(z.object({ start: zHHMM, end: zHHMM }).nullable()).length(7),
});
export type TemplateInput = z.input<typeof templateSchema>;

export const attendanceSchema = z.object({
  userId: zId,
  storeId: zId,
  day: zDay,
  action: z.enum(["chegou", "saiu", "falta", "justificar", "folga", "ferias", "limpar"]),
  time: zHHMM.optional(),
  note: zOptText(300),
});
export type AttendanceInput = z.input<typeof attendanceSchema>;
