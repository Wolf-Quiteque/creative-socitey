import { DocListPage } from "../doc-list";

export const metadata = { title: "Contagens" };

export default function Page() {
  return <DocListPage type="ajuste" newHref="/stock/ajustes/nova" newLabel="Nova contagem" newPerm="stock.ajustar" emptyText="Conte o stock da loja e o sistema corrige as diferenças, deixando registo." />;
}
