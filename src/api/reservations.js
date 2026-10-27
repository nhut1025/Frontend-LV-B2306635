// src/api/reservations.js
import client from './client';

export const reservationsApi = {
  suggestTables: (partySize) =>
    client.get('/reservations/suggest-tables', { params: { party_size: partySize } }),
  createHold: (data) => client.post('/reservations', data),
  listMine: () => client.get('/reservations'),
  cancelMine: (id, data) => client.patch(`/reservations/${id}/cancel`, data),
  getPreorder: (id) => client.get(`/reservations/${id}/preorder`),
  listPendingPreorders: () => client.get('/reservations/preorders/pending'),
  updatePreorderContact: (id, result) =>
    client.patch(`/reservations/${id}/preorder/contact`, { result }),
  preparePreorder: (id) => client.post(`/reservations/${id}/preorder/prepare`),
  listUpcoming: () => client.get('/reservations/upcoming'),
  getById: (id) => client.get(`/reservations/${id}`),
  getDepositQr: (id) => client.get(`/reservations/${id}/deposit-qr`),
  listPendingDeposits: () => client.get('/reservations/pending-deposits'),
  listPendingRefunds: () => client.get('/reservations/pending-refunds'),
  confirmRefund: (id) => client.patch(`/reservations/${id}/confirm-refund`),
  confirmDeposit: (id) => client.patch(`/reservations/${id}/confirm-deposit`),
  confirmArrival: (id) => client.patch(`/reservations/${id}/confirm-arrival`),
  cancelByStaff: (id, data = {}) => client.patch(`/reservations/${id}/cancel-by-staff`, data),
};