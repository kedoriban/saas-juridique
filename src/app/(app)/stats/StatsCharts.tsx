"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

// ─── types ───────────────────────────────────────────────────────────────────

type Period = "7j" | "30j" | "12m";

export interface StatsArret {
  date_arret: string;
  langue: string;
  procedure_type: string | null;
  pays_origine: string | null;
}

export interface TopCriterion {
  label: string;
  section: string;
  count: number;
  pct: number;
}

interface Props {
  arrets: StatsArret[];
  topCriteria: TopCriterion[];
  analysedCount: number;
}

// ─── constants ────────────────────────────────────────────────────────────────

const LANGUE_COLORS: Record<string, string> = {
  fr: "#3b82f6",
  nl: "#f97316",
};
const LANGUE_LABELS: Record<string, string> = {
  fr: "Français",
  nl: "Nederlands",
};

const PROCEDURE_LABELS: Record<string, string> = {
  asile: "Asile",
  annulation: "Annulation",
  plein_contentieux: "Plein cont.",
  autre: "Autre",
  unknown: "Inconnu",
};
const PROCEDURE_COLORS: Record<string, string> = {
  asile: "#3a5346",
  annulation: "#ef4444",
  plein_contentieux: "#3b82f6",
  autre: "#6b7280",
  unknown: "#d1d5db",
};

const PAYS_COLOR = "#699b7e";

// ─── helpers ─────────────────────────────────────────────────────────────────

function cutoff(period: Period): Date {
  const now = new Date();
  if (period === "7j")
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30j")
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
}

function formatKey(d: Date, period: Period): string {
  if (period === "12m")
    return d.toLocaleDateString("fr-BE", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" });
}

function buildTimeSeries(arrets: StatsArret[], period: Period) {
  const now = new Date();
  const from = cutoff(period);
  const expected: string[] = [];

  if (period === "12m") {
    for (let i = 11; i >= 0; i--) {
      expected.push(
        formatKey(new Date(now.getFullYear(), now.getMonth() - i, 1), period)
      );
    }
  } else {
    const days = period === "7j" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      expected.push(
        formatKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), period)
      );
    }
  }

  const counts: Record<string, number> = Object.fromEntries(
    expected.map((k) => [k, 0])
  );
  for (const a of arrets) {
    const d = new Date(a.date_arret);
    if (d >= from && d <= now) {
      const k = formatKey(d, period);
      if (k in counts) counts[k]++;
    }
  }
  return expected.map((k) => ({ date: k, count: counts[k] }));
}

function buildPaysData(arrets: StatsArret[], period: Period) {
  const from = cutoff(period);
  const filtered =
    period === "12m"
      ? arrets
      : arrets.filter((a) => new Date(a.date_arret) >= from);

  const map: Record<string, number> = {};
  for (const a of filtered) {
    if (a.pays_origine) map[a.pays_origine] = (map[a.pays_origine] ?? 0) + 1;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top6 = sorted.slice(0, 6);
  const autres = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  const data = top6.map(([name, value]) => ({ name, value }));
  if (autres > 0) data.push({ name: "Autres", value: autres });
  return data;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {(["7j", "30j", "12m"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
            value === p
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {children}
    </h2>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
      {message}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StatsCharts({
  arrets,
  topCriteria,
  analysedCount,
}: Props) {
  const [periodTimeline, setPeriodTimeline] = useState<Period>("12m");
  const [periodPays, setPeriodPays] = useState<Period>("12m");

  // Langue donut
  const langueData = Object.entries(
    arrets.reduce(
      (acc, a) => ({ ...acc, [a.langue]: (acc[a.langue] ?? 0) + 1 }),
      {} as Record<string, number>
    )
  ).map(([name, value]) => ({ name, value }));

  // Procédure donut
  const procData = Object.entries(
    arrets.reduce((acc, a) => {
      const k = a.procedure_type ?? "unknown";
      return { ...acc, [k]: (acc[k] ?? 0) + 1 };
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Time series
  const timelineData = buildTimeSeries(arrets, periodTimeline);
  const hasTimeline = timelineData.some((d) => d.count > 0);

  // Pays bar chart
  const paysData = buildPaysData(arrets, periodPays);

  return (
    <div className="space-y-4">
      {/* Row 1: Langue donut + Procédure donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Langue */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionTitle>Répartition linguistique</SectionTitle>
          {langueData.length === 0 ? (
            <EmptyChart message="Aucune donnée" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={langueData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {langueData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={LANGUE_COLORS[entry.name] ?? "#d1d5db"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    value,
                    LANGUE_LABELS[String(name)] ?? String(name),
                  ]}
                />
                <Legend
                  formatter={(v) => LANGUE_LABELS[v] ?? v}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Procédure */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionTitle>Type de procédure</SectionTitle>
          {procData.length === 0 ? (
            <EmptyChart message="Aucune donnée" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={procData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {procData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PROCEDURE_COLORS[entry.name] ?? "#d1d5db"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    value,
                    PROCEDURE_LABELS[String(name)] ?? String(name),
                  ]}
                />
                <Legend
                  formatter={(v) => PROCEDURE_LABELS[v] ?? v}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Évolution temporelle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Évolution temporelle</SectionTitle>
          <PeriodToggle value={periodTimeline} onChange={setPeriodTimeline} />
        </div>
        {!hasTimeline ? (
          <EmptyChart message="Aucun arrêt sur cette période" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={timelineData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                formatter={(v) => [v, "Arrêts"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3a5346"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3a5346" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 3: Pays d'origine */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Pays d&apos;origine (top 6)</SectionTitle>
          <PeriodToggle value={periodPays} onChange={setPeriodPays} />
        </div>
        {paysData.length === 0 ? (
          <EmptyChart message="Aucun pays renseigné sur cette période" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, paysData.length * 36)}>
            <BarChart
              data={paysData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f3f4f6"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: "#374151" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                formatter={(v) => [v, "Arrêts"]}
              />
              <Bar dataKey="value" fill={PAYS_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 4: Top critères */}
      {topCriteria.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionTitle>
            Résumé par critères — top {topCriteria.length} (sur {analysedCount}{" "}
            arrêt{analysedCount !== 1 ? "s" : ""} analysé
            {analysedCount !== 1 ? "s" : ""})
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Section", "Critère", "Extractions", "% arrêts"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-2 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topCriteria.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-2 py-2.5 text-xs text-gray-400 max-w-[120px]">
                      <span className="line-clamp-1">{c.section}</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-xs">
                      <span className="line-clamp-2">{c.label}</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs font-semibold text-gray-900 tabular-nums text-right">
                      {c.count}
                    </td>
                    <td className="px-2 py-2.5 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-forest-400 rounded-full"
                            style={{ width: `${Math.min(c.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums w-8 text-right">
                          {c.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
