"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS: Record<string, string> = {
  annulation: "#ef4444",
  plein_contentieux: "#3b82f6",
  confirmation: "#22c55e",
  refus: "#f97316",
  irrecevabilite: "#a855f7",
  autre: "#6b7280",
  "Non défini": "#e5e7eb",
};

const LABELS: Record<string, string> = {
  annulation: "Annulation",
  plein_contentieux: "Plein contentieux",
  confirmation: "Confirmation",
  refus: "Refus",
  irrecevabilite: "Irrecevabilité",
  autre: "Autre",
  "Non défini": "Non défini",
};

interface Props {
  data: { name: string; value: number }[];
}

export default function DecisionDonut({ data }: Props) {
  const filtered = data.filter((d) => d.value > 0 && d.name !== "Non défini");

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <p className="text-sm text-gray-400 text-center">
          Aucune donnée
        </p>
        <p className="text-xs text-gray-300 text-center">
          Le champ type_decision sera renseigné par le worker lors de la prochaine analyse.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {filtered.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name] ?? "#d1d5db"}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            value,
            LABELS[String(name)] ?? String(name),
          ]}
        />
        <Legend
          formatter={(value: string) => LABELS[value] ?? value}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
