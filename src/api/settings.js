// src/api/settings.js
import client from './client';

export const settingsApi = {
  getBank: () => client.get('/settings/bank'),
  updateBank: (data) => client.put('/settings/bank', data),
  getTableTransferDuration: () => client.get('/settings/table-transfer'),
  updateTableTransferDuration: (duration_minutes) =>
    client.put('/settings/table-transfer', { duration_minutes }),
};