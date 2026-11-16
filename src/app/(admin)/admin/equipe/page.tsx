import { requireOwnerPage } from "@/lib/auth";
import type { StaffUser } from "@/lib/supabase/types";
import { AddStaffDialog } from "./add-staff-dialog";
import { StaffRow } from "./staff-row";

export default async function TeamPage() {
  const { supabase, profile } = await requireOwnerPage();

  const { data: staff } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Quem atende aparece como opção para o cliente escolher.
          </p>
        </div>
        <AddStaffDialog />
      </div>

      <ul className="space-y-2">
        {((staff ?? []) as StaffUser[]).map((member) => (
          <StaffRow key={member.id} member={member} isSelf={member.id === profile.id} />
        ))}
      </ul>
    </div>
  );
}
