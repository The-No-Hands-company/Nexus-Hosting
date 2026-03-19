import { requireAuth, getConfig } from "./config.js";

export interface ApiError {
  message: string;
  code?: string;
  status: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const cfg = auth ? requireAuth() : getConfig();
  const baseUrl = (cfg.nodeUrl ?? "").replace(/\/$/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth && cfg.token) {
    headers["Authorization"] = `Bearer ${cfg.token}`;
  }

  const res = await fetch(`${baseUrl}/api${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch { /* ignore */ }
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiUpload(
  uploadUrl: string,
  file: Buffer,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
}
