"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fieldClass } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { parseMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { registerSale, type SaleInput } from "./actions";

type Product = { id: string; name: string; sale_price: number; quantity: number };
type Option = { id: string; label: string };
type Line =
  | { key: string; productId: string; name: string; price: number; quantity: number }
  | { key: string; productId: null; name: string; price: number; quantity: number };

const METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
  { key: "fiado", label: "Fiado" },
] as const;

export function SaleForm({
  products,
  customers,
  appointments,
  sellers,
  defaultSellerId,
  canChooseSeller,
}: {
  products: Product[];
  customers: Option[];
  appointments: (Option & { customerId: string | null })[];
  sellers: Option[];
  defaultSellerId: string;
  canChooseSeller: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"] | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [sellerId, setSellerId] = useState(defaultSellerId);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const subtotal = lines.reduce((s, l) => s + Math.round(l.price * l.quantity * 100) / 100, 0);
  const discountValue = parseMoney(discount) ?? 0;
  const total = Math.max(subtotal - discountValue, 0);

  function addProduct(p: Product) {
    setLines((prev) => {
      const found = prev.find((l) => l.productId === p.id);
      if (found) return prev.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: p.id, productId: p.id, name: p.name, price: Number(p.sale_price), quantity: 1 }];
    });
  }

  function addExtra() {
    const price = parseMoney(extraPrice);
    if (!extraName.trim() || price === null) {
      toast.error("Informe a descrição e o valor do item avulso.");
      return;
    }
    setLines((prev) => [...prev, { key: crypto.randomUUID(), productId: null, name: extraName.trim(), price, quantity: 1 }]);
    setExtraName("");
    setExtraPrice("");
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }])),
    );
  }

  function submit() {
    if (!method) return;
    if (discountValue > subtotal) {
      toast.error("O desconto é maior que o total.");
      return;
    }
    const input: SaleInput = {
      items: lines.map((l) =>
        l.productId
          ? { productId: l.productId, quantity: l.quantity }
          : { description: l.name, quantity: l.quantity, unitPrice: l.price },
      ),
      paymentMethod: method,
      discount: discountValue,
      customerId: customerId || null,
      appointmentId: appointmentId || null,
      sellerId: sellerId || null,
    };
    startTransition(async () => {
      const result = await registerSale(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Venda de ${formatCurrency(total)} registrada!`);
      setLines([]);
      setDiscount("");
      setMethod(null);
      setCustomerId("");
      setAppointmentId("");
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="h-11 pl-9 text-base" />
        </div>
        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum produto com preço de venda. Cadastre em Produtos (dono) ou use um item avulso.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="rounded-xl border bg-card p-3 text-left transition hover:border-primary"
              >
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(p.sale_price))}</p>
                <p className={cn("text-xs", p.quantity <= 0 ? "text-destructive" : "text-muted-foreground")}>
                  {p.quantity <= 0 ? "Sem estoque" : `${Number(p.quantity)} em estoque`}
                </p>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="Item avulso (ex.: sobrancelha)" className="h-11" />
          <Input value={extraPrice} onChange={(e) => setExtraPrice(e.target.value)} inputMode="decimal" placeholder="R$" className="h-11 w-24" />
          <Button type="button" variant="outline" className="h-11" onClick={addExtra}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Venda atual</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Toque num produto para começar.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => changeQty(l.key, -1)} aria-label="Menos">
                  {l.quantity === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
                </Button>
                <span className="w-5 text-center tabular-nums">{l.quantity}</span>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => changeQty(l.key, 1)} aria-label="Mais">
                  <Plus className="size-3.5" />
                </Button>
                <span className="w-20 text-right tabular-nums">{formatCurrency(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="appointmentId">Comanda de um atendimento de hoje (opcional)</Label>
          <select
            id="appointmentId"
            className={fieldClass}
            value={appointmentId}
            onChange={(e) => {
              setAppointmentId(e.target.value);
              const appt = appointments.find((a) => a.id === e.target.value);
              if (appt?.customerId) setCustomerId(appt.customerId);
            }}
          >
            <option value="">Nenhum (venda de balcão)</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerId">Cliente</Label>
          <select id="customerId" className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Consumidor final</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {canChooseSeller && (
          <div className="space-y-1.5">
            <Label htmlFor="sellerId">Vendedor</Label>
            <select id="sellerId" className={fieldClass} value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="discount">Desconto (R$)</Label>
          <Input id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0,00" className="h-11" />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={cn(
                "h-11 rounded-lg border text-xs font-medium transition",
                method === m.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatCurrency(total)}</span>
        </div>
        <Button type="button" size="lg" className="h-12 w-full gap-2 text-base" disabled={pending || lines.length === 0 || !method} onClick={submit}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {!method ? "Escolha a forma de pagamento" : `Cobrar ${formatCurrency(total)}`}
        </Button>
      </div>
    </div>
  );
}
