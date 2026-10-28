"use server";

// Server Actions finas: confirmam a sessão (act) e passam tudo ao domínio, onde estão as regras.
import { act } from "@/lib/action";
import * as catalog from "@/lib/domain/catalog";
import * as stock from "@/lib/domain/stock";
import * as purchases from "@/lib/domain/purchases";
import * as sales from "@/lib/domain/sales";
import * as finance from "@/lib/domain/finance";
import * as hr from "@/lib/domain/hr";
import * as team from "@/lib/domain/team";
import * as stores from "@/lib/domain/stores";

// Catálogo
export const saveProductAction = async (id: string | null, input: unknown) => act(({ db, actor }) => catalog.saveProduct(db, actor, id, input), { message: "Produto guardado." });
export const setProductActiveAction = async (id: string, active: boolean) => act(({ db, actor }) => catalog.setProductActive(db, actor, id, active));
export const saveCategoryAction = async (id: string | null, input: unknown) => act(({ db, actor }) => catalog.saveCategory(db, actor, id, input), { message: "Categoria guardada." });
export const deleteCategoryAction = async (id: string) => act(({ db, actor }) => catalog.deleteCategory(db, actor, id), { message: "Categoria apagada." });

// Stock
export const createSaidaAction = async (input: unknown) => act(({ db, actor }) => stock.createSaida(db, actor, input), { message: "Nota de saída registada." });
export const sendTransferAction = async (input: unknown) => act(({ db, actor }) => stock.sendTransfer(db, actor, input), { message: "Transferência enviada." });
export const receiveTransferAction = async (input: unknown) => act(({ db, actor }) => stock.receiveTransfer(db, actor, input), { message: "Transferência recebida." });
export const cancelTransferAction = async (id: string) => act(({ db, actor }) => stock.cancelTransfer(db, actor, id), { message: "Transferência cancelada." });
export const createAdjustmentAction = async (input: unknown) => act(({ db, actor }) => stock.createAdjustment(db, actor, input), { message: "Contagem registada." });

// Compras
export const saveSupplierAction = async (id: string | null, input: unknown) => act(({ db, actor }) => purchases.saveSupplier(db, actor, id, input), { message: "Fornecedor guardado." });
export const savePurchaseAction = async (id: string | null, input: unknown) => act(({ db, actor }) => purchases.savePurchase(db, actor, id, input), { message: "Compra guardada." });
export const receivePurchaseAction = async (id: string) => act(({ db, actor }) => purchases.receivePurchase(db, actor, id), { message: "Mercadoria deu entrada no stock." });
export const payPurchaseAction = async (id: string, input: unknown) => act(({ db, actor }) => purchases.payPurchase(db, actor, id, input), { message: "Pagamento registado." });
export const cancelPurchaseAction = async (id: string) => act(({ db, actor }) => purchases.cancelPurchase(db, actor, id), { message: "Compra cancelada." });

// Vendas
export const createSaleAction = async (input: unknown) => act(({ db, actor }) => sales.createSale(db, actor, input), { refresh: false });
export const voidSaleAction = async (id: string, reason: string) => act(({ db, actor }) => sales.voidSale(db, actor, id, reason), { message: "Venda anulada." });
export const returnSaleAction = async (input: unknown) => act(({ db, actor }) => sales.returnSale(db, actor, input), { message: "Devolução registada." });
export const openTillAction = async (storeId: string, float: number) => act(({ db, actor }) => sales.openTill(db, actor, storeId, float), { message: "Caixa aberta." });
export const closeTillAction = async (tillId: string, counted: number, note?: string) => act(({ db, actor }) => sales.closeTill(db, actor, tillId, counted, note), { message: "Caixa fechada." });

// Finanças
export const createEntryAction = async (input: unknown) => act(({ db, actor }) => finance.createEntry(db, actor, input), { message: "Movimento registado." });
export const voidEntryAction = async (id: string, reason: string) => act(({ db, actor }) => finance.voidEntry(db, actor, id, reason), { message: "Movimento anulado." });
export const transferAccountsAction = async (input: unknown) => act(({ db, actor }) => finance.transferBetweenAccounts(db, actor, input), { message: "Transferência registada." });
export const saveAccountAction = async (id: string | null, input: unknown) => act(({ db, actor }) => finance.saveAccount(db, actor, id, input), { message: "Conta guardada." });
export const saveFinCategoryAction = async (id: string | null, input: unknown) => act(({ db, actor }) => finance.saveFinCategory(db, actor, id, input), { message: "Categoria guardada." });

// RH
export const saveShiftAction = async (input: unknown) => act(({ db, actor }) => hr.saveShift(db, actor, input), { message: "Turno guardado." });
export const deleteShiftAction = async (userId: string, day: string) => act(({ db, actor }) => hr.deleteShift(db, actor, userId, day), { message: "Turno apagado." });
export const saveTemplateAction = async (input: unknown) => act(({ db, actor }) => hr.saveTemplate(db, actor, input), { message: "Modelo semanal guardado." });
export const applyTemplatesAction = async (input: unknown) => act(({ db, actor }) => hr.applyTemplates(db, actor, input));
export const copyWeekAction = async (input: unknown) => act(({ db, actor }) => hr.copyWeek(db, actor, input));
export const markAttendanceAction = async (input: unknown) => act(({ db, actor }) => hr.markAttendance(db, actor, input));

// Equipa
export const saveUserAction = async (id: string | null, input: unknown) => act(({ db, actor }) => team.saveUser(db, actor, id, input), { message: "Conta guardada." });
export const setUserActiveAction = async (id: string, active: boolean) => act(({ db, actor }) => team.setUserActive(db, actor, id, active));
export const saveRoleAction = async (id: string | null, input: unknown) => act(({ db, actor }) => team.saveRole(db, actor, id, input), { message: "Cargo guardado." });
export const deleteRoleAction = async (id: string) => act(({ db, actor }) => team.deleteRole(db, actor, id), { message: "Cargo apagado." });

// Lojas e definições
export const saveStoreAction = async (id: string | null, input: unknown) => act(({ db, actor }) => stores.saveStore(db, actor, id, input), { message: "Loja guardada." });
export const saveSettingsAction = async (input: unknown) => act(({ db, actor }) => stores.saveSettings(db, actor, input), { message: "Definições guardadas." });
