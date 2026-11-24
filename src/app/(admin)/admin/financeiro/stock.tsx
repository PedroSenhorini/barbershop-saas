"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Minus, MoreVertical, Package, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/supabase/types";
import { addProduct, adjustStock, deleteProduct, registerPurchase } from "./actions";

function qty(n: number) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function StockList({ products, today }: { products: Product[]; today: string }) {
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState<Product | null>(null);
  const low = products.filter((p) => Number(p.quantity) <= Number(p.min_quantity));

  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Acabando: <b>{low.map((p) => p.name).join(", ")}</b>
          </span>
        </p>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Produtos</h2>
        <Button className="h-9 gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 size-8" />
          Cadastre o que você usa ou vende (pomada, lâmina, shampoo...) para saber quando está acabando.
        </div>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onBuy={() => setBuying(p)} />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Equipamentos (máquina, cadeira, secador) não precisam de estoque: lance como gasto na aba Gastos.
      </p>

      <ProductDialog open={adding} onOpenChange={setAdding} />
      <PurchaseDialog product={buying} onClose={() => setBuying(null)} today={today} />
    </div>
  );
}

function ProductRow({ product: p, onBuy }: { product: Product; onBuy: () => void }) {
  const [pending, startTransition] = useTransition();
  const isLow = Number(p.quantity) <= Number(p.min_quantity);

  function change(delta: number) {
    startTransition(async () => {
      const result = await adjustStock(p.id, delta);
      if ("error" in result) toast.error(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Excluir "${p.name}"? As compras já lançadas continuam nos gastos.`)) return;
    startTransition(async () => {
      const result = await deleteProduct(p.id);
      if ("error" in result) toast.error(result.error);
      else toast.success("Produto excluído");
    });
  }

  return (
    <li className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", isLow && "border-amber-300 dark:border-amber-800")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.name}</p>
        <p className={cn("text-sm", isLow ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {qty(p.quantity)} em estoque
          {Number(p.min_quantity) > 0 && ` · mínimo ${qty(p.min_quantity)}`}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label={`Usei/vendi 1 ${p.name}`}
        disabled={pending || Number(p.quantity) <= 0}
        onClick={() => change(-1)}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Minus className="size-4" />}
      </Button>
      <Button variant="outline" className="h-10 gap-1.5" onClick={onBuy}>
        <ShoppingCart className="size-4" />
        Comprei
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Mais opções">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => change(1)}>Somar 1 (sem lançar gasto)</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={remove}>
            Excluir produto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, formAction, isPending] = useActionState(addProduct, { error: null });

  const [handledOk, setHandledOk] = useState(state.ok);
  if (state.ok !== handledOk) {
    setHandledOk(state.ok);
    onOpenChange(false);
  }
  useEffect(() => {
    if (state.ok) toast.success("Produto cadastrado");
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="Ex.: Pomada modeladora" className="h-11 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Tem agora</Label>
              <Input id="quantity" name="quantity" inputMode="decimal" defaultValue="0" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minQuantity">Avisar com</Label>
              <Input id="minQuantity" name="minQuantity" inputMode="decimal" defaultValue="2" className="h-11 text-base" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Quando o estoque chegar no &quot;Avisar com&quot;, o produto aparece como acabando.
          </p>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isPending}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Cadastrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDialog({
  product,
  onClose,
  today,
}: {
  product: Product | null;
  onClose: () => void;
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    if (!product) return;
    setError(null);
    startTransition(async () => {
      const result = await registerPurchase(
        product.id,
        String(formData.get("qty") ?? ""),
        String(formData.get("amount") ?? ""),
        String(formData.get("spentOn") ?? ""),
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Compra registrada: estoque e gasto atualizados");
      onClose();
    });
  }

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comprei {product?.name}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantidade</Label>
              <Input id="qty" name="qty" required inputMode="decimal" defaultValue="1" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor total (R$)</Label>
              <Input id="amount" name="amount" required inputMode="decimal" placeholder="0,00" className="h-11 text-base" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spentOn">Data da compra</Label>
            <Input id="spentOn" name="spentOn" type="date" required defaultValue={today} className="h-11 text-base" />
          </div>
          <p className="text-xs text-muted-foreground">Soma no estoque e entra nos gastos do mês como Produtos.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : "Registrar compra"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
