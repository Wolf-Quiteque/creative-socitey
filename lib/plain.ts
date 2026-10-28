import type { ObjectId, Binary } from "mongodb";

/** Versão serializável de um documento: ObjectId e Date passam a string */
export type Plain<T> = T extends ObjectId
  ? string
  : T extends Date
    ? string
    : T extends Binary
      ? never
      : T extends Array<infer U>
        ? Plain<U>[]
        : T extends object
          ? { [K in keyof T]: Plain<T[K]> }
          : T;

/** Converte documentos do Mongo em objetos simples para passar a componentes de cliente */
export function toPlain<T>(value: T): Plain<T> {
  return JSON.parse(JSON.stringify(value));
}
