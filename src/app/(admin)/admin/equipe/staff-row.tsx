"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import type { StaffUser } from "@/lib/supabase/types";
import { removeStaffMember, setTakesAppointments } from "./actions";

export function StaffRow({ member, isSelf }: { member: StaffUser; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle(value: boolean) {
    startTransition(async () => {
      const result = await setTakesAppointments(member.id, value);
      if ("error" in result) toast.error(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Remover ${member.full_name} da equipe? Ele perde o acesso ao painel.`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeStaffMember(member.id);
      if ("error" in result) toast.error(result.error);
      else toast.success("Removido da equipe.");
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <Avatar>
        <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.full_name} {isSelf && <span className="text-muted-foreground">(você)</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{member.role === "owner" ? "Dono" : "Barbeiro"}</Badge>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={member.takes_appointments}
              disabled={pending}
              onChange={(e) => toggle(e.target.checked)}
            />
            Atende clientes
          </label>
        </div>
      </div>
      {!isSelf && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remover ${member.full_name}`}
          disabled={pending}
          onClick={remove}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      )}
    </li>
  );
}
