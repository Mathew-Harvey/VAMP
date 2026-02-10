import apiClient from './client';

export const workOrdersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/work-orders', { params }),
  getById: (id: string) => apiClient.get(`/work-orders/${id}`),
  create: (data: any) => apiClient.post('/work-orders', data),
  update: (id: string, data: any) => apiClient.put(`/work-orders/${id}`, data),
  changeStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/work-orders/${id}/status`, { status, reason }),
  assign: (id: string, userId: string, role: string) =>
    apiClient.post(`/work-orders/${id}/assign`, { userId, role }),
  unassign: (id: string, userId: string) =>
    apiClient.delete(`/work-orders/${id}/assign/${userId}`),
  submitTask: (woId: string, taskId: string, data: any) =>
    apiClient.post(`/work-orders/${woId}/tasks/${taskId}/submit`, data),
  approveTask: (woId: string, taskId: string, notes?: string) =>
    apiClient.post(`/work-orders/${woId}/tasks/${taskId}/approve`, { notes }),
  rejectTask: (woId: string, taskId: string, notes?: string) =>
    apiClient.post(`/work-orders/${woId}/tasks/${taskId}/reject`, { notes }),
  getComments: (id: string) => apiClient.get(`/work-orders/${id}/comments`),
  addComment: (id: string, content: string, parentId?: string) =>
    apiClient.post(`/work-orders/${id}/comments`, { content, parentId }),
  delete: (id: string) => apiClient.delete(`/work-orders/${id}`),
};
