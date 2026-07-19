export const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN || "localhost"}`;

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { adminToken?: string } = {}
): Promise<T> {
  const { adminToken, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (adminToken) {
    headers["x-admin-secret"] = adminToken;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
