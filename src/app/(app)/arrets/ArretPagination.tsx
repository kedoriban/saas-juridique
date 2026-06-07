"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PER_PAGE_OPTIONS = [10, 25, 50];

interface Props {
  page: number;
  perPage: number;
  total: number;
}

export default function ArretPagination({ page, perPage, total }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) params.set(k, v);
    return `${pathname}?${params.toString()}`;
  }

  function nav(updates: Record<string, string>) {
    router.push(buildUrl(updates));
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
      {/* Per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Lignes&nbsp;:</span>
        {PER_PAGE_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => nav({ per_page: String(n), page: "1" })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              perPage === n
                ? "bg-forest-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => nav({ page: String(page - 1) })}
          disabled={page <= 1}
          className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        <span className="text-xs text-gray-600 tabular-nums px-1">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => nav({ page: String(page + 1) })}
          disabled={page >= totalPages}
          className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}
