import client from './client';

export const financeApi = {
  listBills: (params) => client.get('/finance/bills', { params }),
  listDepositTransactions: (params) => client.get('/finance/deposits', { params }),
  getBillDetail: (billId) => client.get(`/finance/bills/${billId}`),
};