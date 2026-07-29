"use client";

export type SortDir = "asc" | "desc";

export default function SortableTh({
  label, sortKey, currentKey, currentDir, onSort,
}: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  currentDir: SortDir;
  onSort: (key: string) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => onSort(sortKey)}
      title="Click to sort"
    >
      {label} <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}

// Generic sort helper: pass the array and a function that extracts the
// comparable value for the current sort key from each row.
export function sortRows<T>(
  rows: T[],
  sortKey: string | null,
  sortDir: SortDir,
  getValue: (row: T, key: string) => string | number
): T[] {
  if (!sortKey) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    let av = getValue(a, sortKey);
    let bv = getValue(b, sortKey);
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return copy;
}

// Toggle handler factory: click same column flips direction, click a new
// column starts at ascending.
export function makeSortHandler(
  sortKey: string | null,
  setSortKey: (k: string) => void,
  sortDir: SortDir,
  setSortDir: (d: SortDir) => void
) {
  return (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
}
