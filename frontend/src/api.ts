import type { CaseStudy, CompareRequest, CompareResponse } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, public status?: number, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(`Cannot reach the HomeForge API at ${API_BASE}. Is the backend running?`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const msg =
      res.status === 422 && Array.isArray(detail)
        ? "Invalid input: " +
          detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")} — ${d.msg}`).join("; ")
        : `API error ${res.status}`;
    throw new ApiError(msg, res.status, detail);
  }
  return body as T;
}

export const fetchCaseStudy = () => request<CaseStudy>("/api/case-study");

export const postCompare = (req: CompareRequest, signal?: AbortSignal) =>
  request<CompareResponse>("/api/compare", { method: "POST", body: JSON.stringify(req), signal });
