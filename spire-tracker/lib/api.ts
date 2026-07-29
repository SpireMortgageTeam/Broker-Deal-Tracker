export async function loadArr<T>(key: string): Promise<T[]> {
  try {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.value) ? data.value : [];
  } catch {
    return [];
  }
}

export async function saveArr<T>(key: string, arr: T[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arr),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
}
