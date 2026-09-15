// src/api/settings.js
import client from './client';

export const settingsApi = {
  getBank: () => client.get('/settings/bank'),
  updateBank: (data) => client.put('/settings/bank', data),
};