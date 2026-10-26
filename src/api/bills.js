import client from './client';

export const billsApi = {
  listMyHistory: () => client.get('/bills/my-history'),
  getByTable: (tableId) => client.get(`/bills/table/${tableId}`),
  addItem: (billId, data) => client.post(`/bills/${billId}/items`, data),
  removeItem: (billId, itemId) => client.delete(`/bills/${billId}/items/${itemId}`),

  // Phase 6: Kitchen Display System
  kitchenQueue: () => client.get('/bills/kitchen-queue'),
  readyItems: () => client.get('/bills/ready-items'),
  advanceItem: (itemId) => client.patch(`/bills/items/${itemId}/advance`),
  serveItem: (itemId) => client.patch(`/bills/items/${itemId}/serve`),

    // Phase 7: thanh toán bill cuối (thu_ngan)
  payable: () => client.get('/bills/payable'),
  paymentSummary: (billId) => client.get(`/bills/${billId}/payment-summary`),
  paymentQr: (billId) => client.get(`/bills/${billId}/payment-qr`),
  requestPayment: (billId, paymentMethod) =>
    client.post(`/bills/${billId}/payment-request`, { payment_method: paymentMethod }),
  pay: (billId, paymentMethod) => client.patch(`/bills/${billId}/pay`, { payment_method: paymentMethod }),
};
