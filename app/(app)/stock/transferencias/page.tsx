import { DocListPage } from "../doc-list";

export const metadata = { title: "Transferências" };

export default function Page() {
  return <DocListPage type="transferencia" newHref="/stock/transferencias/nova" newLabel="Nova transferência" newPerm="stock.transf_enviar" emptyText="Quando enviar mercadoria de uma loja para outra, aparece aqui." />;
}
