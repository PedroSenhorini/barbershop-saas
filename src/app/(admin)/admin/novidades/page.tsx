import { Sparkles } from "lucide-react";
import { Card, Page, PageHeader } from "@/components/page-ui";
import { requireStaff } from "@/lib/auth";
import { CHANGELOG } from "@/lib/changelog";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default async function NewsPage() {
  await requireStaff();
  return (
    <Page>
      <PageHeader title="Novidades" description="O que mudou no sistema." />
      <ol className="space-y-3">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.date}>
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                {i === 0 && <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />}
                <h2 className="font-semibold">{entry.title}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </Page>
  );
}
