// src/api/ingredients.js
import client from './client';

export const ingredientsApi = {
  list: () => client.get('/ingredients'),
  create: (name) => client.post('/ingredients', { name }),
  update: (id, name) => client.put(`/ingredients/${id}`, { name }),
  remove: (id) => client.delete(`/ingredients/${id}`),
};
