import client from './client';

export const financeApi = {
  listBills: (params) => client.get('/finance/bills', { params }),
  getBillDetail: (billId) => client.get(`/finance/bills/${billId}`),
};