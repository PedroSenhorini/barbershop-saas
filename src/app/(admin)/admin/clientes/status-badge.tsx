import { Badge } from "@/components/ui/badge";
import { CUSTOMER_STATUS_LABEL, type CustomerStatus } from "@/lib/customers";
import { cn } from "@/lib/utils";

const STYLE: Record<CustomerStatus, string> = {
  novo: "bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200",
  ativo: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200",
  sumido: "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200",
  sem_visita: "bg-muted text-muted-foreground",
};

export function CustomerStatusBadge({ status, className }: { status: CustomerStatus; className?: string }) {
  return <Badge className={cn("h-6", STYLE[status], className)}>{CUSTOMER_STATUS_LABEL[status]}</Badge>;
}
