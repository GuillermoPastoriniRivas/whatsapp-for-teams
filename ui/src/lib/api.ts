const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

let onUnauthorizedCallback: (() => void) | null = null;

export function onUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Devuelve el access token nuevo, o `null` si el backend RECHAZÓ el refresh
 * (sesión inválida de verdad). Lanza si falló por red/servidor caído: en ese
 * caso NO hay que cerrar la sesión, solo reintentar más tarde.
 */
export async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return null;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);

      const data = await res.json();
      localStorage.setItem("accessToken", data.accessToken);
      // El backend rota el refresh token en cada uso (sesión deslizante)
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      api.setToken(data.accessToken);
      return data.accessToken as string;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      // FormData bodies set their own multipart boundary — don't override it
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !isRetry) {
      let newToken: string | null = null;
      let refreshNetworkError = false;
      try {
        newToken = await tryRefreshToken();
      } catch {
        refreshNetworkError = true;
      }
      if (newToken) {
        return this.request<T>(path, options, true);
      }
      // Solo cerrar sesión si el refresh fue rechazado, no si falló la red
      if (!refreshNetworkError) onUnauthorizedCallback?.();
      throw new ApiError(401, "Session expired");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, error.message || res.statusText);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  upload<T>(path: string, form: FormData) {
    return this.request<T>(path, { method: "POST", body: form });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const api = new ApiClient();
