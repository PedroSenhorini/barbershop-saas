import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicForm } from "@/components/public-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeSource } from "@/lib/labels";
import { loadPublicBarbershop } from "@/lib/public-barbershop";
import { registerLead } from "../public-actions";

const load = loadPublicBarbershop;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await load((await params).slug);
  return shop ? { title: `Cadastro — ${shop.name}` } : {};
}

/**
 * Cadastro rápido para ações na porta (sorteio, QR no balcão) e indicação:
 * quem indicou informa o próprio WhatsApp no campo "quem te indicou".
 */
export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ origem?: string; indicou?: string }>;
}) {
  const shop = await load((await params).slug);
  if (!shop) notFound();
  const sp = await searchParams;

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="space-y-1">
        <Link href={`/${shop.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <h1 className="text-2xl font-semibold">Cadastre-se</h1>
        <p className="text-sm text-muted-foreground">
          Deixe seu contato para receber novidades e promoções da {shop.name}.
        </p>
      </div>

      {!shop.active ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">Cadastro indisponível no momento.</p>
      ) : (
        <PublicForm
          action={registerLead}
          hidden={{ barbershopId: shop.id, source: normalizeSource(sp.origem) ?? "porta" }}
          submitLabel="Quero me cadastrar"
          successTitle="Cadastro feito!"
          successText="Obrigado! Fique de olho no WhatsApp."
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" name="name" required autoComplete="name" className="h-12 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" inputMode="numeric" required autoComplete="tel" placeholder="(11) 91234-5678" className="h-12 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referredBy">WhatsApp de quem te indicou (opcional)</Label>
            <Input
              id="referredBy"
              name="referredBy"
              type="tel"
              inputMode="numeric"
              defaultValue={sp.indicou?.replace(/\D/g, "").slice(0, 11) ?? ""}
              className="h-12 text-base"
            />
          </div>
        </PublicForm>
      )}
    </main>
  );
}
