// src/api/reservations.js
import client from './client';

export const reservationsApi = {
  suggestTables: (partySize) =>
    client.get('/reservations/suggest-tables', { params: { party_size: partySize } }),
  createHold: (data) => client.post('/reservations', data),
  listMine: () => client.get('/reservations'),
  getById: (id) => client.get(`/reservations/${id}`),
  getDepositQr: (id) => client.get(`/reservations/${id}/deposit-qr`),
  listPendingDeposits: () => client.get('/reservations/pending-deposits'),
  confirmDeposit: (id) => client.patch(`/reservations/${id}/confirm-deposit`),
};