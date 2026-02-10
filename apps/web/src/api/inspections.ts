import apiClient from './client';

export const inspectionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/inspections', { params }),
  getById: (id: string) => apiClient.get(`/inspections/${id}`),
  create: (data: any) => apiClient.post('/inspections', data),
  update: (id: string, data: any) => apiClient.put(`/inspections/${id}`, data),
  addFinding: (id: string, data: any) =>
    apiClient.post(`/inspections/${id}/findings`, data),
  updateFinding: (inspectionId: string, findingId: string, data: any) =>
    apiClient.put(`/inspections/${inspectionId}/findings/${findingId}`, data),
  complete: (id: string) => apiClient.patch(`/inspections/${id}/complete`),
  approve: (id: string) => apiClient.patch(`/inspections/${id}/approve`),
};
