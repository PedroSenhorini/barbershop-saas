"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, MORE_ITEM, findItem, isActive, visibleAreas } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SideNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const areas = visibleAreas(isOwner);
  const hrefs = areas.flatMap((a) => a.items.map((i) => i.href));
  return (
    <nav className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
      {areas.map((area) => (
        <div key={area.title} className="space-y-0.5">
          <p className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
            {area.title}
          </p>
          {area.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive(item.href, pathname, hrefs) && "bg-muted text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const areas = visibleAreas(isOwner);
  const hrefs = areas.flatMap((a) => a.items.map((i) => i.href));
  const tabs = MOBILE_TABS.filter((href) => hrefs.includes(href))
    .map((href) => findItem(href)!)
    .concat(MORE_ITEM);
  // "Mais" fica ativo em qualquer tela que não seja um dos atalhos.
  const onTab = tabs.some((t) => t !== MORE_ITEM && isActive(t.href, pathname, hrefs));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {tabs.map((item) => {
        const active = item === MORE_ITEM ? !onTab : isActive(item.href, pathname, hrefs);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-opacity active:opacity-70",
              active && "text-primary",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
