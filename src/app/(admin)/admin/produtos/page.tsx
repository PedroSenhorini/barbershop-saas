import { ActionForm } from "@/components/action-form";
import { Card, Empty, List, Page, PageHeader, Section } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOwnerPage } from "@/lib/auth";
import type { Product } from "@/lib/supabase/types";
import { createProduct, setSalePrice } from "./actions";

const money = (n: number | null) => (n === null ? "" : Number(n).toFixed(2).replace(".", ","));

export default async function ProductsPage() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("products").select("*").order("name");
  const products = (data ?? []) as Product[];

  return (
    <Page>
      <PageHeader
        title="Produtos"
        description="Defina o preço de venda para o produto aparecer em Vender. Sem preço, ele fica só no estoque (uso interno). Quantidades e compras continuam em Financeiro → Estoque."
      />

      <Section title="Preço de venda">
        {products.length === 0 ? (
          <Empty>Nenhum produto ainda.</Empty>
        ) : (
          <List>
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{Number(p.quantity)} em estoque</p>
                </div>
                <ActionForm action={setSalePrice} submitLabel="Salvar" successMessage="Preço salvo!" className="flex items-start gap-2 space-y-0" submitClassName="h-9" submitVariant="outline">
                  <input type="hidden" name="id" value={p.id} />
                  <Input
                    name="salePrice"
                    inputMode="decimal"
                    placeholder="Sem venda"
                    defaultValue={money(p.sale_price)}
                    aria-label={`Preço de venda de ${p.name}`}
                    className="h-9 w-28"
                  />
                </ActionForm>
              </li>
            ))}
          </List>
        )}
      </Section>

      <Section title="Novo produto">
        <Card>
          <ActionForm action={createProduct} submitLabel="Criar produto" successMessage="Produto criado!" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required maxLength={80} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salePrice">Preço de venda (vazio = não vende)</Label>
                <Input id="salePrice" name="salePrice" inputMode="decimal" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantidade em estoque</Label>
                <Input id="quantity" name="quantity" type="number" min={0} step="any" defaultValue={0} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minQuantity">Avisar quando ficar abaixo de</Label>
                <Input id="minQuantity" name="minQuantity" type="number" min={0} step="any" defaultValue={0} className="h-11" />
              </div>
            </div>
          </ActionForm>
        </Card>
      </Section>
    </Page>
  );
}
