const PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return PALETTE[hash % PALETTE.length];
}

export function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${tagColor(tag)}`}
    >
      {tag}
    </span>
  );
}
