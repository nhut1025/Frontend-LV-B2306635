// src/api/dishes.js
import client from './client';

export const dishesApi = {
  list: (params) => client.get('/dishes', { params }),
  getById: (id) => client.get(`/dishes/${id}`),
  uploadImage: (file) => {
    const data = new FormData();
    data.append('image', file);
    return client.post('/dishes/upload-image', data);
  },
  create: (data) => client.post('/dishes', data),
  update: (id, data) => client.put(`/dishes/${id}`, data),
  toggleAvailability: (id, is_available) => client.patch(`/dishes/${id}/availability`, { is_available }),
  remove: (id) => client.delete(`/dishes/${id}`),
};
