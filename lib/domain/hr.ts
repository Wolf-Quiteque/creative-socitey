import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { col, getSettings, type AttendanceDoc } from "../db";
import { assertCan, can, canAccessStore, oid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { attendanceSchema, shiftSchema, templateSchema, zDay, zId } from "../validation";
import { addDays, daysBetween, hhmmToMin, luandaDay, luandaInstant, luandaMinutes, weekday } from "../time";
import { ATTENDANCE_STATUS } from "../types";

async function workerFor(db: Db, userIdRaw: string, storeId: ObjectId) {
  const u = await col.users(db).findOne({ _id: oid(userIdRaw) });
  if (!u || !u.active) throw new UserError("Pessoa não encontrada ou inativa.");
  if (!u.allStores && !u.isOwner && !u.storeIds.some((s) => s.equals(storeId))) throw new UserError(`${u.name} não trabalha nesta loja.`);
  return u;
}

export async function saveShift(db: Db, actor: Actor, input: unknown) {
  const data = shiftSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "rh.horarios_gerir", storeId);
  if (hhmmToMin(data.end) <= hhmmToMin(data.start)) throw new UserError("A hora de saída tem de ser depois da entrada.");
  const u = await workerFor(db, data.userId, storeId);
  await col.shifts(db).updateOne(
    { userId: u._id, day: data.day },
    { $set: { storeId, start: data.start, end: data.end, note: data.note }, $setOnInsert: { createdBy: who(actor), createdAt: new Date() } },
    { upsert: true },
  );
  return {};
}

export async function deleteShift(db: Db, actor: Actor, userIdRaw: unknown, dayRaw: unknown) {
  const userId = oid(userIdRaw);
  const day = zDay.parse(dayRaw);
  const shift = await col.shifts(db).findOne({ userId, day });
  if (!shift) return {};
  assertCan(actor, "rh.horarios_gerir", shift.storeId);
  await col.shifts(db).deleteOne({ _id: shift._id });
  return {};
}

export async function saveTemplate(db: Db, actor: Actor, input: unknown) {
  const data = templateSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "rh.horarios_gerir", storeId);
  for (const d of data.days) if (d && hhmmToMin(d.end) <= hhmmToMin(d.start)) throw new UserError("Em cada dia, a saída tem de ser depois da entrada.");
  const u = await workerFor(db, data.userId, storeId);
  await col.templates(db).updateOne({ _id: u._id }, { $set: { storeId, days: data.days, updatedAt: new Date() } }, { upsert: true });
  return {};
}

/** Cria turnos a partir dos modelos semanais das pessoas da loja */
export async function applyTemplates(db: Db, actor: Actor, input: unknown) {
  const data = z.object({ storeId: zId, from: zDay, to: zDay, overwrite: z.boolean() }).parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "rh.horarios_gerir", storeId);
  if (data.to < data.from) throw new UserError("A data final tem de ser depois da inicial.");
  const days = daysBetween(data.from, data.to);
  if (days.length > 62) throw new UserError("Aplique no máximo 2 meses de cada vez.");
  const templates = await col.templates(db).find({ storeId }).toArray();
  let created = 0;
  for (const t of templates) {
    const u = await col.users(db).findOne({ _id: t._id, active: true });
    if (!u) continue;
    for (const day of days) {
      const slot = t.days[weekday(day)];
      if (!slot) continue;
      const filter = { userId: t._id, day };
      if (!data.overwrite && (await col.shifts(db).findOne(filter))) continue;
      await col.shifts(db).updateOne(
        filter,
        { $set: { storeId, start: slot.start, end: slot.end }, $setOnInsert: { createdBy: who(actor), createdAt: new Date() } },
        { upsert: true },
      );
      created++;
    }
  }
  await audit(db, actor, "horarios.modelo", "shift", `Modelos aplicados de ${data.from} a ${data.to} (${created} turnos)`, { storeId });
  return { created };
}

export async function copyWeek(db: Db, actor: Actor, input: unknown) {
  const data = z.object({ storeId: zId, fromWeek: zDay, toWeek: zDay, overwrite: z.boolean() }).parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "rh.horarios_gerir", storeId);
  const source = await col.shifts(db).find({ storeId, day: { $gte: data.fromWeek, $lte: addDays(data.fromWeek, 6) } }).toArray();
  const offset = Math.round((Date.parse(data.toWeek) - Date.parse(data.fromWeek)) / 86_400_000);
  let created = 0;
  for (const s of source) {
    const day = addDays(s.day, offset);
    const filter = { userId: s.userId, day };
    if (!data.overwrite && (await col.shifts(db).findOne(filter))) continue;
    await col.shifts(db).updateOne(
      filter,
      { $set: { storeId, start: s.start, end: s.end, note: s.note }, $setOnInsert: { createdBy: who(actor), createdAt: new Date() } },
      { upsert: true },
    );
    created++;
  }
  return { created };
}

/** Confirma presença, saída ou falta. Hoje: "confirmar presenças". Dias anteriores: "corrigir presenças". */
export async function markAttendance(db: Db, actor: Actor, input: unknown) {
  const data = attendanceSchema.parse(input);
  const storeId = oid(data.storeId);
  const today = luandaDay();
  if (data.day > today) throw new UserError("Não é possível marcar presenças no futuro.");
  assertCan(actor, data.day === today ? "rh.presencas_confirmar" : "rh.presencas_editar", storeId);
  const u = await workerFor(db, data.userId, storeId);
  if (u._id.equals(actor.id) && !actor.isOwner) throw new UserError("Não pode confirmar a sua própria presença. Peça a um responsável.");
  if (data.time && data.day === today && hhmmToMin(data.time) > luandaMinutes() + 5) throw new UserError("A hora indicada ainda não chegou.");

  const settings = await getSettings(db);
  const shift = await col.shifts(db).findOne({ userId: u._id, day: data.day });
  const existing = await col.attendance(db).findOne({ userId: u._id, day: data.day });
  const now = new Date();
  const at = data.time ? luandaInstant(data.day, data.time) : now;
  const by = who(actor);

  if (data.action === "limpar") {
    if (existing) await col.attendance(db).deleteOne({ _id: existing._id });
    await audit(db, actor, "presenca.limpar", "attendance", `Registo de ${u.name} em ${data.day} apagado`, { storeId });
    return {};
  }

  const set: Partial<AttendanceDoc> = {
    userName: u.name,
    storeId,
    scheduledStart: shift?.start,
    scheduledEnd: shift?.end,
    confirmedBy: by,
    confirmedAt: now,
  };
  let change = "";
  switch (data.action) {
    case "chegou": {
      const min = hhmmToMin(data.time ?? luandaClock(at));
      const late = shift ? Math.max(0, min - hhmmToMin(shift.start)) : 0;
      set.checkIn = at;
      set.lateMinutes = late;
      set.status = late > settings.lateToleranceMin ? "atrasado" : "presente";
      change = `Entrada às ${luandaClock(at)}${late > settings.lateToleranceMin ? ` (${late} min de atraso)` : ""}`;
      break;
    }
    case "saiu":
      if (!existing?.checkIn) throw new UserError("Registe primeiro a chegada.");
      if (at < existing.checkIn) throw new UserError("A saída não pode ser antes da entrada.");
      set.checkOut = at;
      set.status = existing.status;
      change = `Saída às ${luandaClock(at)}`;
      break;
    case "falta":
      set.status = "falta";
      change = "Falta";
      break;
    case "justificar":
      if (!data.note) throw new UserError("Escreva a justificação.");
      set.status = "falta_justificada";
      change = "Falta justificada";
      break;
    case "folga":
      set.status = "folga";
      change = "Folga";
      break;
    case "ferias":
      set.status = "ferias";
      change = "Férias";
      break;
  }
  if (data.note) set.note = data.note;
  if (data.action === "falta" || data.action === "justificar" || data.action === "folga" || data.action === "ferias") {
    set.checkIn = undefined;
    set.checkOut = undefined;
    set.lateMinutes = undefined;
  }
  const unset: Record<string, ""> = {};
  for (const [k, v] of Object.entries(set)) if (v === undefined) unset[k] = "";
  const clean = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined));
  await col.attendance(db).updateOne(
    { userId: u._id, day: data.day },
    { $set: clean, ...(Object.keys(unset).length ? { $unset: unset } : {}), $push: { history: { at: now, by, change: data.note ? `${change} — ${data.note}` : change } } },
    { upsert: true },
  );
  if (data.day !== today) await audit(db, actor, "presenca.corrigir", "attendance", `${u.name}, ${data.day}: ${change}`, { storeId });
  return { status: set.status as keyof typeof ATTENDANCE_STATUS };
}

function luandaClock(d: Date): string {
  const m = luandaMinutes(d);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

