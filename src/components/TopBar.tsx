"use client";

import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function TopBar({ userEmail }: { userEmail: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <span className="font-semibold text-gray-900 text-sm">CCE / RVV</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 hidden sm:block">{userEmail}</span>
        <Link
          href="/parametres"
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title="Paramètres"
        >
          ⚙
        </Link>
        <form>
          <button
            formAction={logout}
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
