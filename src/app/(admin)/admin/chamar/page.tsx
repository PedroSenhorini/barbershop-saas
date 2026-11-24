import { daysSince, msDaysAgo } from "@/lib/time";
import Link from "next/link";
import { Empty, List, Page, PageHeader, Section } from "@/components/page-ui";
import { requireStaff } from "@/lib/auth";
import { loadCustomerRows } from "@/lib/customer-data";
import { formatDaysAgo } from "@/lib/customers";
import { maskPhone } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { comeBackMessage, whatsAppLink } from "@/lib/whatsapp";
import { ContactButton } from "./contact-button";

/** Depois de chamado, o cliente sai da fila por este tempo. */
const COOLDOWN_DAYS = 14;

export default async function CallBackPage() {
  const { supabase, barbershop } = await requireStaff();
  const [rows, siteUrl] = await Promise.all([loadCustomerRows(supabase), getSiteUrl()]);
  const bookingUrl = `${siteUrl}/${barbershop.slug}?origem=whatsapp`;
  const cutoff = msDaysAgo(COOLDOWN_DAYS);

  const gone = rows.filter((r) => r.insight.status === "sumido");
  const queue = gone
    .filter((r) => !r.customer.last_contacted_at || new Date(r.customer.last_contacted_at).getTime() < cutoff)
    // Quem sumiu há menos tempo primeiro: é quem mais volta quando chamado.
    .sort((a, b) => a.insight.daysOverdue - b.insight.daysOverdue);
  const recent = gone.filter((r) => !queue.includes(r));

  return (
    <Page>
      <PageHeader
        title="Chamar quem sumiu"
        description={`Clientes que passaram do tempo em que costumam voltar. Cada toque abre o WhatsApp com a mensagem pronta e o link para agendar; quem foi chamado sai da fila por ${COOLDOWN_DAYS} dias.`}
      />

      <Section title={`Para chamar (${queue.length})`}>
        {queue.length === 0 ? (
          <Empty>Ninguém para chamar agora. 👏</Empty>
        ) : (
          <List>
            {queue.map(({ customer, insight }) => (
              <li key={customer.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/clientes/${customer.id}`} className="font-medium hover:underline">
                    {customer.name}
                  </Link>
                  <p className="truncate text-muted-foreground">
                    {maskPhone(customer.phone)} · última visita {formatDaysAgo(insight.daysSinceLastVisit ?? 0)}
                    {insight.averageIntervalDays ? ` · vinha a cada ${insight.averageIntervalDays} dias` : ""}
                  </p>
                </div>
                <ContactButton
                  customerId={customer.id}
                  href={whatsAppLink(
                    customer.phone,
                    comeBackMessage({ customerName: customer.name, barbershopName: barbershop.name, bookingUrl }),
                  )}
                />
              </li>
            ))}
          </List>
        )}
      </Section>

      {recent.length > 0 && (
        <Section title={`Chamados nos últimos ${COOLDOWN_DAYS} dias (${recent.length})`}>
          <List>
            {recent.map(({ customer }) => (
              <li key={customer.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/admin/clientes/${customer.id}`} className="hover:underline">
                  {customer.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  chamado {formatDaysAgo(daysSince(customer.last_contacted_at!))}
                </span>
              </li>
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}
