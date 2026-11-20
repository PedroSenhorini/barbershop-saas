"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Scissors, Settings, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Agenda", icon: CalendarDays, ownerOnly: false },
  // Barbeiro também vê: lá aparece só o próprio faturamento.
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet, ownerOnly: false },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors, ownerOnly: true },
  { href: "/admin/equipe", label: "Equipe", icon: Users, ownerOnly: true },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings, ownerOnly: true },
];

function useItems(isOwner: boolean) {
  const pathname = usePathname();
  return ITEMS.filter((item) => isOwner || !item.ownerOnly).map((item) => ({
    ...item,
    active:
      item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href),
  }));
}

export function SideNav({ isOwner }: { isOwner: boolean }) {
  const items = useItems(isOwner);
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
            item.active && "bg-muted text-foreground",
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ isOwner }: { isOwner: boolean }) {
  const items = useItems(isOwner);
  if (items.length < 2) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground",
            item.active && "text-primary",
          )}
        >
          <item.icon className="size-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
