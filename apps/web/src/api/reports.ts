import apiClient from './client';

const BASE = '/reports';

export const reportsApi = {
  /** Generate a report. Returns { data } with report payload (e.g. html for inspection). */
  generate: (type: 'inspection' | 'work-order', workOrderId: string) =>
    apiClient.post<{ data: any }>(`${BASE}/generate`, { type, workOrderId }),

  /** Absolute URL for report preview (open in new tab; cookies sent same-origin). */
  getPreviewUrl: (workOrderId: string) => {
    const base = (import.meta.env.VITE_API_URL as string)?.replace(/\/+$/, '');
    const path = `${BASE}/preview/${workOrderId}`;
    if (base) return `${base}${path}`;
    if (typeof window !== 'undefined') return `${window.location.origin}/api/v1${path}`;
    return `/api/v1${path}`;
  },
};
