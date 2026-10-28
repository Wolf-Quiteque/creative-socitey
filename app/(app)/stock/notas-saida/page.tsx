import { DocListPage } from "../doc-list";

export const metadata = { title: "Notas de saída" };

export default function Page() {
  return <DocListPage type="saida" newHref="/stock/notas-saida/nova" newLabel="Nova nota de saída" newPerm="stock.nota_saida" emptyText="Quebras, ofertas, uso interno e devoluções ao fornecedor ficam registados aqui." />;
}
