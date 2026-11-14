import client from './client';

export const financeApi = {
  listBills: (params) => client.get('/finance/bills', { params }),
  listTopSellingDishes: (period) => client.get('/finance/top-dishes', { params: { period } }),
  listDepositTransactions: (params) => client.get('/finance/deposits', { params }),
  getBillDetail: (billId) => client.get(`/finance/bills/${billId}`),
};