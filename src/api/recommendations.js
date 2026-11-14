import client from './client';

export const recommendationsApi = {
  list: (params) => client.get('/recommendations', { params }),
  mine: (params) => client.get('/recommendations/me', { params }),
};
