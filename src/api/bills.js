import client from './client';

export const billsApi = {
    getByTable: (tableId) => client.get(`/bills/table/${tableId}`),
    addItem: (billId , data) => client.post(`/bills/${billId}/items`, data),
    removeItem: (billId, itemId) => client.delete(`/bills/${billId}/items/${itemId}`),
};