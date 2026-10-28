import { NavTabs } from "@/components/ui/nav-tabs";

export function ProductTabs() {
  return (
    <NavTabs
      items={[
        { href: "/produtos", label: "Produtos", exact: true },
        { href: "/produtos/categorias", label: "Categorias" },
      ]}
    />
  );
}
