import client from './client';

export const categoriesApi = {
  list: () => client.get('/categories'),
  create: (name) => client.post('/categories', { name }),
  update: (id, name) => client.put(`/categories/${id}`, { name }),
  remove: (id) => client.delete(`/categories/${id}`),
};
