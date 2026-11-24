import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, Page, PageHeader } from "@/components/page-ui";
import { ThemeSelector } from "@/components/theme-toggle";
import { requireStaff } from "@/lib/auth";
import { visibleAreas } from "@/lib/nav";

/** Todas as telas, agrupadas pelo que o dono quer fazer. */
export default async function MorePage() {
  const { profile } = await requireStaff();
  const areas = visibleAreas(profile.role === "owner");

  return (
    <Page>
      <PageHeader title="Mais" description="Tudo o que o sistema faz, organizado por área." />
      {areas.map((area) => (
        <section key={area.title} className="space-y-2">
          <div>
            <h2 className="font-semibold">{area.title}</h2>
            <p className="text-xs text-muted-foreground">{area.hint}</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {area.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <div>
          <h2 className="font-semibold">Aparência</h2>
          <p className="text-xs text-muted-foreground">Automático segue o tema do celular.</p>
        </div>
        <Card>
          <ThemeSelector />
        </Card>
      </section>
    </Page>
  );
}
