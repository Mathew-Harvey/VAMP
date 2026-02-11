import { useAuthStore } from '../stores/auth.store';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

type RequestConfig = {
  params?: QueryParams;
  headers?: Record<string, string>;
  _retry?: boolean;
};

type ApiResponse<T = any> = {
  data: T;
  status: number;
  headers: Headers;
};

type ApiError = Error & {
  response?: ApiResponse;
  status?: number;
  config?: InternalRequestConfig;
};

type InternalRequestConfig = RequestConfig & {
  method: string;
  url: string;
  data?: BodyInit | null;
};

const RAW_API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE = RAW_API_BASE ? RAW_API_BASE.replace(/\/+$/, '') : '';

function buildUrl(url: string, params?: QueryParams): string {
  const baseUrl = API_BASE ? `${API_BASE}${url}` : `/api/v1${url}`;
  if (!params) return baseUrl;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function normalizeBody(data?: any): BodyInit | null {
  if (data == null) return null;
  if (data instanceof FormData || data instanceof URLSearchParams || typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data);
}

async function parseResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

async function refreshToken(): Promise<string | null> {
  try {
    const refreshUrl = API_BASE ? `${API_BASE}/auth/refresh` : '/api/v1/auth/refresh';
    const response = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await parseResponseBody(response);
    if (!response.ok || !data?.success || !data?.data?.accessToken) return null;
    const accessToken = data.data.accessToken as string;
    useAuthStore.getState().setToken(accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

async function request<T = any>(config: InternalRequestConfig): Promise<ApiResponse<T>> {
  const token = useAuthStore.getState().accessToken;
  const isFormData = config.data instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(config.headers || {}),
  };

  // Let browser build multipart boundary automatically.
  if (isFormData && headers['Content-Type'] === 'multipart/form-data') {
    delete headers['Content-Type'];
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(config.url, config.params), {
    method: config.method,
    credentials: 'include',
    headers,
    body: config.data ?? null,
  });
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error: ApiError = new Error((data as any)?.error?.message || 'Request failed');
    error.response = { data, status: response.status, headers: response.headers };
    error.status = response.status;
    error.config = config;

    if (response.status === 401 && !config._retry) {
      const newToken = await refreshToken();
      if (newToken) {
        return request<T>({ ...config, _retry: true });
      }
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    throw error;
  }

  return { data, status: response.status, headers: response.headers };
}

const apiClient = {
  get: <T = any>(url: string, config?: RequestConfig) =>
    request<T>({ ...(config || {}), method: 'GET', url }),
  delete: <T = any>(url: string, config?: RequestConfig) =>
    request<T>({ ...(config || {}), method: 'DELETE', url }),
  post: <T = any>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...(config || {}), method: 'POST', url, data: normalizeBody(data) }),
  put: <T = any>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...(config || {}), method: 'PUT', url, data: normalizeBody(data) }),
  patch: <T = any>(url: string, data?: any, config?: RequestConfig) =>
    request<T>({ ...(config || {}), method: 'PATCH', url, data: normalizeBody(data) }),
};

export default apiClient;
