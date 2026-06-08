"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconDocument, IconBookmark, IconChart, IconClipboard } from "@/components/icons";

const navItems = [
  { href: "/dashboard",  label: "Accueil", Icon: IconHome },
  { href: "/arrets",     label: "Arrêts",  Icon: IconDocument },
  { href: "/stats",      label: "Stats",   Icon: IconChart },
];

export default function BottomNav({ userRole }: { userRole?: string }) {
  const pathname = usePathname();
  const canValidate = userRole === "admin" || userRole === "avocat";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-16">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-1 pb-2 transition-colors relative ${
                isActive ? "text-forest-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-600 rounded-b-full" />
              )}
              <Icon className="w-5 h-5" />
              <span className={`text-[10px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </Link>
          );
        })}
        {canValidate ? (
          <Link
            href="/validation"
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-1 pb-2 transition-colors relative ${
              pathname.startsWith("/validation") ? "text-forest-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {pathname.startsWith("/validation") && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-600 rounded-b-full" />
            )}
            <IconClipboard className="w-5 h-5" />
            <span className={`text-[10px] leading-none ${pathname.startsWith("/validation") ? "font-semibold" : "font-medium"}`}>
              Validation
            </span>
          </Link>
        ) : (
          <div
            title="Disponible prochainement"
            className="flex-1 flex flex-col items-center justify-center gap-1 pt-1 pb-2 text-gray-200 cursor-not-allowed select-none"
          >
            <IconBookmark className="w-5 h-5" />
            <span className="text-[10px] leading-none font-medium">Focus</span>
          </div>
        )}
      </div>
    </nav>
  );
}
