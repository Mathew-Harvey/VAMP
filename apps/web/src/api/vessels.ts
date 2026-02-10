import apiClient from './client';

export const vesselsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/vessels', { params }),
  getById: (id: string) => apiClient.get(`/vessels/${id}`),
  create: (data: any) => apiClient.post('/vessels', data),
  update: (id: string, data: any) => apiClient.put(`/vessels/${id}`, data),
  delete: (id: string) => apiClient.delete(`/vessels/${id}`),
};
