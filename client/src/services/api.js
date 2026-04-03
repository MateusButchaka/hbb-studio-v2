import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min (geração de arte pode demorar)
});

export const clientsApi = {
  getAll: () => api.get('/clients'),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

export const artsApi = {
  generate: (formData) => api.post('/generate-art', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000, // 3 min
  }),
  getAll: (params) => api.get('/arts', { params }),
  getById: (id) => api.get(`/arts/${id}`),
  delete: (id) => api.delete(`/arts/${id}`),
};

export const dashboardApi = {
  getData: () => api.get('/dashboard'),
};

export default api;
