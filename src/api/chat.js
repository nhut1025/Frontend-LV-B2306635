import client from './client';

export const chatApi = {
  conversations: () => client.get('/chat/conversations'),
  unreadCount: () => client.get('/chat/unread-count'),
  messages: (conversationId) => client.get(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, content, attachment) => {
    const body = new FormData();
    if (conversationId) body.append('conversation_id', conversationId);
    if (content) body.append('content', content);
    if (attachment) body.append('attachment', attachment);
    return client.post('/chat/messages', body);
  },
  takeOver: (conversationId) => client.patch(`/chat/conversations/${conversationId}/takeover`),
  close: (conversationId) => client.patch(`/chat/conversations/${conversationId}/close`),
  downloadAttachment: (messageId) =>
    client.get(`/chat/messages/${messageId}/attachment`, { responseType: 'blob' }),
};
