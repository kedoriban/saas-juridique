"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Accueil", icon: "⊞" },
  { href: "/arrets", label: "Arrêts", icon: "📄" },
  { href: "/recherche", label: "Recherche", icon: "🔍" },
  { href: "/criteres", label: "Critères", icon: "☑" },
  { href: "/stats", label: "Stats", icon: "📊" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t border-gray-200 flex items-center">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors ${
              isActive
                ? "text-blue-600 font-semibold"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
