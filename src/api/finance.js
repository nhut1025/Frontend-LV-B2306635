import client from './client';

export const financeApi = {
  listBills: (params) => client.get('/finance/bills', { params }),
  listPaymentHistory: (params) => client.get('/finance/payment-history', { params }),
  getPaymentHistoryDetail: (billId) => client.get(`/finance/payment-history/${billId}`),
  listTopSellingDishes: (period) => client.get('/finance/top-dishes', { params: { period } }),
  listDepositTransactions: (params) => client.get('/finance/deposits', { params }),
  getBillDetail: (billId) => client.get(`/finance/bills/${billId}`),
};