import client from './client';

export const usersApi = {
  getProfile: () => client.get('/users/me'),
  updateProfile: (data) => client.put('/users/me', data),
  getExcludedIngredients: () => client.get('/users/me/excluded-ingredients'),
  setExcludedIngredients: (ingredient_ids) => client.put('/users/me/excluded-ingredients', { ingredient_ids }),
};
