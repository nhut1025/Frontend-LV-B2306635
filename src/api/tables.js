// src/api/tables.js
import client from './client';

export const tablesApi = {
  list: () => client.get('/tables'),
  getById: (id) => client.get(`/tables/${id}`),
  create: (data) => client.post('/tables', data),
  update: (id, data) => client.put(`/tables/${id}`, data),
  remove: (id) => client.delete(`/tables/${id}`),
};
