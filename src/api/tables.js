// src/api/tables.js
import client from './client';

export const tablesApi = {
  list: () => client.get('/tables'),
  getById: (id) => client.get(`/tables/${id}`),
  walkIn: (id) => client.patch(`/tables/${id}/walk-in`),
  release: (id) => client.patch(`/tables/${id}/release`),
  create: (data) => client.post('/tables', data),
  update: (id, data) => client.put(`/tables/${id}`, data),
  remove: (id) => client.delete(`/tables/${id}`),
};
