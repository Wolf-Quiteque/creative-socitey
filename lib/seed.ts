import { ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { col, DEFAULT_SETTINGS } from "./db";
import { ROLE_PRESETS } from "./permissions";
import { DEFAULT_CATEGORIES, SYSTEM_CATEGORIES, systemCategory } from "./domain/finance";

const PRODUCT_CATEGORIES = [
  { name: "Perucas", type: "cabelo" as const },
  { name: "Extensões e tranças", type: "cabelo" as const },
  { name: "Cuidados do cabelo", type: "beleza" as const },
  { name: "Maquilhagem", type: "beleza" as const },
  { name: "Cuidados da pele", type: "beleza" as const },
  { name: "Unhas", type: "beleza" as const },
  { name: "Acessórios", type: "outro" as const },
];

/** Dados mínimos para começar. Pode correr várias vezes sem duplicar nada. */
export async function seedBase(db: Db, opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const now = new Date();

  await col.settings(db).updateOne({ _id: "app" }, { $setOnInsert: { ...DEFAULT_SETTINGS, updatedAt: now } }, { upsert: true });

  // Dono (a partir do .env)
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");
  const owner = await col.users(db).findOne({ isOwner: true });
  if (!owner) {
    await col.users(db).insertOne({
      _id: new ObjectId(),
      name: "Dono",
      username: "dono",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      isOwner: true,
      roleId: null,
      allStores: true,
      storeIds: [],
      extraPermissions: [],
      removedPermissions: [],
      jobTitle: "Proprietário",
      active: true,
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    log("Conta do dono criada (entra com ADMIN_EMAIL e ADMIN_PASSWORD do .env).");
  }

  for (const r of ROLE_PRESETS) {
    const res = await col.roles(db).updateOne(
      { name: r.name },
      { $setOnInsert: { _id: new ObjectId(), ...r, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
    if (res.upsertedCount) log(`Cargo «${r.name}» criado.`);
  }

  for (const key of Object.keys(SYSTEM_CATEGORIES)) await systemCategory(db, key);
  if ((await col.finCategories(db).countDocuments({ key: { $exists: false } })) === 0) {
    await col.finCategories(db).insertMany(DEFAULT_CATEGORIES.map((c) => ({ _id: new ObjectId(), ...c, active: true, createdAt: now })));
    log("Categorias de entradas e saídas criadas.");
  }

  if ((await col.accounts(db).countDocuments({ type: "banco" })) === 0) {
    await col.accounts(db).insertOne({ _id: new ObjectId(), name: "Banco (TPA e transferências)", type: "banco", storeId: null, openingBalance: 0, active: true, createdAt: now });
    log("Conta bancária geral criada.");
  }

  if ((await col.categories(db).countDocuments()) === 0) {
    await col.categories(db).insertMany(PRODUCT_CATEGORIES.map((c, i) => ({ _id: new ObjectId(), ...c, order: i, createdAt: now })));
    log("Categorias de produtos criadas.");
  }
}
