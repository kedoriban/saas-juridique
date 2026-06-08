"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import {
  IconHome,
  IconDocument,
  IconBookmark,
  IconArrowUpTray,
  IconChart,
  IconCheckSquare,
  IconClipboard,
  IconSettings,
  IconLogout,
} from "@/components/icons";

const mainNav = [
  { href: "/dashboard", label: "Tableau de bord", Icon: IconHome },
  { href: "/arrets",    label: "Arrêts",          Icon: IconDocument },
  { href: "/stats",     label: "Statistiques",    Icon: IconChart },
];

const disabledNav = [
  { label: "Focus",  Icon: IconBookmark },
  { label: "Export", Icon: IconArrowUpTray },
];

const adminNav = [
  { href: "/validation", label: "Validation",     Icon: IconClipboard },
  { href: "/criteres",   label: "Administration", Icon: IconCheckSquare },
  { href: "/parametres", label: "Paramètres",     Icon: IconSettings },
];

function NavItem({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        isActive
          ? "bg-white text-forest-600 shadow-sm"
          : "text-white/80 hover:text-white hover:bg-white/10"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function NavItemDisabled({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      title="Disponible prochainement"
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 cursor-not-allowed select-none"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default function Sidebar({
  userEmail,
  userRole,
}: {
  userEmail: string;
  userRole: string;
}) {
  const canAdmin = userRole === "admin" || userRole === "avocat";
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-forest-600 min-h-screen fixed top-0 left-0 z-30 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
        <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-3 9 3M3 6v14l9 3 9-3V6M3 6l9 3 9-3" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-tight leading-tight">
          CCE <span className="text-white/50 font-normal">/</span> RVV
        </span>
      </div>

      {/* Navigation principale */}
      <nav className="flex flex-col gap-1">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {disabledNav.map((item) => (
          <NavItemDisabled key={item.label} {...item} />
        ))}
      </nav>

      {/* Section Admin */}
      {canAdmin && (
        <div className="mt-6">
          <p className="px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Admin
          </p>
          <nav className="flex flex-col gap-1">
            {adminNav.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>
        </div>
      )}

      {/* Footer user */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="px-3 py-2">
          <p className="text-xs text-white/50 truncate">{userEmail}</p>
        </div>
        <form>
          <button
            formAction={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <IconLogout className="w-4 h-4 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
