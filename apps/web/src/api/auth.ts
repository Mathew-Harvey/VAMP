import apiClient from './client';

export const authApi = {
  login: (email: string, password: string, organisationId?: string) =>
    apiClient.post('/auth/login', { email, password, organisationId }),
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    apiClient.post('/auth/register', data),
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),
  refresh: () => apiClient.post('/auth/refresh'),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/auth/me'),
};
