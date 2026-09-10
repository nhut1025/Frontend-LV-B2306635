// src/api/staff.js
import client from './client';

export const staffApi = {
  list: () => client.get('/users/staff'),
  create: (data) => client.post('/users/staff', data),
  update: (id, data) => client.put(`/users/staff/${id}`, data),
  setActive: (id, is_active) => client.patch(`/users/staff/${id}/active`, { is_active }),
};