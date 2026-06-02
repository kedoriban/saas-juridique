"use client";

import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { IconSettings, IconLogout } from "@/components/icons";

export default function TopBar({ userEmail }: { userEmail: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-forest-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">C</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm tracking-tight">
          CCE <span className="text-gray-400 font-normal">/</span> RVV
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 hidden sm:block mr-2 truncate max-w-[140px]">
          {userEmail}
        </span>
        <Link
          href="/parametres"
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Paramètres"
        >
          <IconSettings className="w-4 h-4" />
        </Link>
        <form>
          <button
            formAction={logout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Déconnexion"
          >
            <IconLogout className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
