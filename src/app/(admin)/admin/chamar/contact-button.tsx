"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markContacted } from "./actions";

/** Abre o WhatsApp com a mensagem pronta e já tira o cliente da fila. */
export function ContactButton({ customerId, href }: { customerId: string; href: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() => {
        window.open(href, "_blank", "noopener,noreferrer");
        start(async () => {
          const r = await markContacted(customerId);
          if (r.error) toast.error(r.error);
        });
      }}
    >
      <MessageCircle className="size-4" />
      Chamar
    </Button>
  );
}
