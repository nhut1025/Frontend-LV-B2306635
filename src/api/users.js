import client from './client';

export const usersApi = {
  getProfile: () => client.get('/users/me'),
  updateProfile: (data) => client.put('/users/me', data),
  listRefundBankAccounts: () => client.get('/users/me/refund-bank-accounts'),
  createRefundBankAccount: (data) => client.post('/users/me/refund-bank-accounts', data),
  updateRefundBankAccount: (id, data) => client.put(`/users/me/refund-bank-accounts/${id}`, data),
  deleteRefundBankAccount: (id) => client.delete(`/users/me/refund-bank-accounts/${id}`),
  uploadAvatar: (data) => client.post('/users/me/avatar', data),
  changePassword: (data) => client.put('/users/me/password', data),
  getReservationSummary: () => client.get('/users/me/reservation-summary'),
  getExcludedIngredients: () => client.get('/users/me/excluded-ingredients'),
  setExcludedIngredients: (ingredient_ids) => client.put('/users/me/excluded-ingredients', { ingredient_ids }),
  getPreferredIngredients: () => client.get('/users/me/preferred-ingredients'),
  setPreferredIngredients: (ingredient_ids) => client.put('/users/me/preferred-ingredients', { ingredient_ids }),
};
