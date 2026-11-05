import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { chatApi } from '../api/chat';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function MessageAttachment({ message, onError }) {
  const [imageUrl, setImageUrl] = useState('');
  const isImage = message.attachment_mime?.startsWith('image/');

  useEffect(() => {
    if (!isImage) return undefined;
    let active = true;
    let objectUrl;
    chatApi.downloadAttachment(message.id)
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        if (active) setImageUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) onError('Không thể tải ảnh đính kèm.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isImage, message.id, onError]);

  async function download() {
    try {
      const { data } = await chatApi.downloadAttachment(message.id);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = message.attachment_filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      onError(getErrorMessage(error));
    }
  }

  if (!message.attachment_filename) return null;
  return (
    <div className="mt-2">
      {isImage && imageUrl ? (
        <button type="button" onClick={download} className="block max-w-full">
          <img src={imageUrl} alt={message.attachment_filename} className="max-h-64 max-w-full rounded-lg object-contain" />
        </button>
      ) : (
        <button
          type="button"
          onClick={download}
          className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm hover:bg-white"
        >
          <FileText size={18} className="shrink-0 text-basil-700" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{message.attachment_filename}</span>
            <span className="text-xs text-slate-500">{formatSize(message.attachment_size)}</span>
          </span>
          <ArrowDownToLine size={16} className="shrink-0" />
        </button>
      )}
      {isImage && imageUrl && (
        <button type="button" onClick={download} className="mt-1 flex items-center gap-1 text-xs text-basil-700">
          <ArrowDownToLine size={13} /> Tải ảnh
        </button>
      )}
    </div>
  );
}

function ConversationMessage({ message, own, onAttachmentError }) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%] ${
        own ? 'rounded-br-md bg-basil-600 text-white' : 'rounded-bl-md bg-white text-ink shadow-sm'
      }`}>
        {!own && <p className="mb-1 text-xs font-semibold text-basil-700">{message.sender_name}</p>}
        {message.content && <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>}
        <MessageAttachment message={message} onError={onAttachmentError} />
        <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? 'text-white/70' : 'text-slate-400'}`}>
          {formatTime(message.created_at)}
          {own && (message.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const isCashier = user?.role === 'thu_ngan';
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [newChat, setNewChat] = useState(false);
  const [cashiersOnline, setCashiersOnline] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [takingOver, setTakingOver] = useState(null);
  const [error, setError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const bottomRef = useRef(null);
  const formRef = useRef(null);
  const selectedRef = useRef(selectedId);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const refreshConversations = useCallback(async () => {
    try {
      const response = await chatApi.conversations();
      setConversations(response.data.conversations);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const refreshMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      setActiveConversation(null);
      setLoadingMessages(false);
      return;
    }
    try {
      setLoadingMessages(true);
      const response = await chatApi.messages(conversationId);
      setActiveConversation(response.data.conversation);
      setMessages(response.data.messages);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    const intervalId = setInterval(refreshConversations, 15000);
    const socket = createSocket();
    const refresh = () => refreshConversations();
    const handleNewMessage = ({ conversation, message }) => {
      refreshConversations();
      if (Number(selectedRef.current) === Number(conversation.id)) {
        setActiveConversation(conversation);
        setMessages((current) => current.some((item) => item.id === message.id)
          ? current
          : [...current, message]);
      }
    };
    const handleClosed = ({ conversation }) => {
      refreshConversations();
      if (Number(selectedRef.current) === Number(conversation.id)) {
        setActiveConversation(conversation);
      }
    };
    socket.on('chat:cashier-presence', ({ online }) => setCashiersOnline(online));
    socket.on('chat:conversation-new', refresh);
    socket.on('chat:assigned', refresh);
    socket.on('chat:read', refresh);
    socket.on('chat:message-new', handleNewMessage);
    socket.on('chat:closed', handleClosed);
    socket.on('connect', () => {
      refreshConversations();
      if (selectedRef.current) refreshMessages(selectedRef.current);
    });
    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [refreshConversations, refreshMessages]);

  useEffect(() => {
    refreshMessages(selectedId);
  }, [selectedId, refreshMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const setAttachmentErrorMessage = useCallback((message) => setAttachmentError(message), []);

  const visibleConversations = conversations.filter((conversation) => {
    if (!isCashier || listFilter === 'all') return true;
    if (listFilter === 'new') return !conversation.staff_id;
    return Number(conversation.staff_id) === Number(user.id);
  });

  async function sendMessage(event) {
    event.preventDefault();
    if ((!draft.trim() && !attachment) || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await chatApi.sendMessage(selectedId, draft.trim(), attachment);
      const { conversation, message } = response.data;
      setSelectedId(conversation.id);
      setNewChat(false);
      setActiveConversation(conversation);
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message]);
      setDraft('');
      setAttachment(null);
      formRef.current?.reset();
      await refreshConversations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  }

  async function takeOver(conversationId) {
    setTakingOver(conversationId);
    setError('');
    try {
      await chatApi.takeOver(conversationId);
      await refreshConversations();
      setSelectedId(conversationId);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setTakingOver(null);
    }
  }

  async function closeConversation() {
    if (!selectedId || !window.confirm('Đóng hội thoại này? Khách sẽ cần gửi tin mới để mở hội thoại khác.')) return;
    setError('');
    try {
      const response = await chatApi.close(selectedId);
      setActiveConversation(response.data.conversation);
      await refreshConversations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const selectedConversation = conversations.find((item) => Number(item.id) === Number(selectedId));
  const assignedToOther = isCashier && selectedConversation?.staff_id
    && Number(selectedConversation.staff_id) !== Number(user.id);
  const composerDisabled = isCashier
    ? !selectedId || activeConversation?.status === 'closed' || assignedToOther
    : false;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-7rem)] min-h-[480px] flex-col md:h-[calc(100vh-13rem)]">
        <div className="mb-4 shrink-0">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isCashier ? 'Tin nhắn với khách' : 'Chat với quán'}
          </h1>
          <p className="text-sm text-slate-500">
            {isCashier ? 'Hộp thư chung dành cho thu ngân.' : 'Hỏi quán về món ăn, giờ mở cửa hoặc đặt bàn.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <aside className={`w-full shrink-0 flex-col border-r border-slate-100 md:flex md:w-80 ${
            selectedId || newChat ? 'hidden' : 'flex'
          }`}>
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-ink">{isCashier ? 'Hộp thư' : 'Lịch sử chat'}</h2>
                {!isCashier && (
                  <button
                    type="button"
                    onClick={() => setNewChat(true)}
                    className="rounded-lg p-2 text-basil-700 hover:bg-basil-50"
                    title="Bắt đầu hội thoại mới"
                  >
                    <MessageCircle size={18} />
                  </button>
                )}
              </div>
              {isCashier && (
                <div className="mt-3 flex gap-2 text-xs">
                  {[
                    ['all', 'Tất cả'],
                    ['new', 'Chưa nhận'],
                    ['mine', 'Của tôi'],
                  ].map(([filter, label]) => (
                    <button
                      type="button"
                      key={filter}
                      onClick={() => setListFilter(filter)}
                      className={`rounded-full px-3 py-1.5 ${listFilter === filter
                        ? 'bg-basil-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
              ) : visibleConversations.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  {isCashier ? 'Chưa có hội thoại trong mục này.' : 'Bạn chưa có hội thoại nào. Hãy gửi tin nhắn để bắt đầu.'}
                </p>
              ) : visibleConversations.map((conversation) => {
                const ownedElsewhere = isCashier && conversation.staff_id
                  && Number(conversation.staff_id) !== Number(user.id);
                return (
                  <div
                    key={conversation.id}
                    className={`border-b border-slate-50 px-4 py-3 ${
                      Number(selectedId) === Number(conversation.id) ? 'bg-basil-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        disabled={ownedElsewhere}
                        onClick={() => setSelectedId(conversation.id)}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">
                            {isCashier ? conversation.customer_name : conversation.staff_name || 'Quán Ăn'}
                          </span>
                          {Number(conversation.unread_count) > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 text-xs font-semibold text-white">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {conversation.last_message || (conversation.last_attachment_filename ? 'Đã gửi tệp đính kèm' : 'Chưa có tin nhắn')}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {conversation.status === 'closed' ? 'Đã đóng' : conversation.staff_name || 'Chưa có người nhận'}
                          {' · '}{formatTime(conversation.last_message_at || conversation.created_at)}
                        </p>
                      </button>
                      {ownedElsewhere && (
                        <button
                          type="button"
                          disabled={takingOver === conversation.id}
                          onClick={() => takeOver(conversation.id)}
                          className="shrink-0 rounded-lg bg-basil-50 px-2 py-1.5 text-xs font-medium text-basil-700 hover:bg-basil-100 disabled:opacity-50"
                        >
                          {takingOver === conversation.id ? <Loader2 size={14} className="animate-spin" /> : 'Tiếp quản'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className={`min-w-0 flex-1 flex-col ${selectedId || newChat ? 'flex' : 'hidden md:flex'}`}>
            {(selectedId || (newChat && !isCashier)) && (
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setNewChat(false);
                  }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                  aria-label="Quay lại danh sách"
                >
                  <X size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-ink">
                    {isCashier
                      ? selectedConversation?.customer_name || activeConversation?.customer_name
                      : activeConversation?.staff_name || selectedConversation?.staff_name || 'Quán Ăn'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeConversation?.status === 'closed' ? 'Hội thoại đã đóng' : isCashier
                      ? selectedConversation?.staff_name || 'Chưa có người nhận'
                      : cashiersOnline === false ? 'Hiện không có thu ngân trực tuyến' : 'Đang hỗ trợ'}
                  </p>
                </div>
                {isCashier && activeConversation?.status === 'open' && Number(activeConversation.staff_id) === Number(user.id) && (
                  <button type="button" onClick={closeConversation} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Đóng hội thoại
                  </button>
                )}
              </header>
            )}

            {selectedId ? (
              <>
                {cashiersOnline === false && !isCashier && activeConversation?.status === 'open' && (
                  <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                    Hiện chưa có thu ngân trực tuyến. Quán sẽ trả lời bạn sớm nhất có thể.
                  </div>
                )}
                {activeConversation?.status === 'closed' && (
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                    Hội thoại đã đóng. Tin nhắn mới của bạn sẽ mở một hội thoại mới.
                  </div>
                )}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-3 py-4 sm:px-5">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</div>
                  ) : messages.map((message) => (
                    <ConversationMessage
                      key={message.id}
                      message={message}
                      own={Number(message.sender_id) === Number(user.id)}
                      onAttachmentError={setAttachmentErrorMessage}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
                {attachmentError && (
                  <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {attachmentError}
                    <button type="button" onClick={() => setAttachmentError('')} aria-label="Đóng lỗi"><X size={14} /></button>
                  </div>
                )}
                {composerDisabled ? (
                  <div className="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-500">
                    {assignedToOther ? 'Hội thoại này đã được thu ngân khác nhận.' : 'Hội thoại đã đóng.'}
                  </div>
                ) : (
                  <form ref={formRef} onSubmit={sendMessage} className="shrink-0 border-t border-slate-100 px-3 py-3 sm:px-5">
                    {attachment && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                        <FileText size={14} />
                        <span className="max-w-[70%] truncate">{attachment.name}</span>
                        <span className="text-slate-400">{formatSize(attachment.size)}</span>
                        <button type="button" onClick={() => setAttachment(null)} aria-label="Bỏ tệp đính kèm">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <label className="cursor-pointer rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" title="Đính kèm (tối đa 20 MB)">
                        <Paperclip size={19} />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                          onChange={(event) => {
                            setAttachment(event.target.files?.[0] || null);
                            setAttachmentError('');
                          }}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(Array.from(event.target.value).slice(0, 1500).join(''))}
                          maxLength={3000}
                          rows={1}
                          placeholder="Nhập tin nhắn..."
                          className="max-h-32 min-h-10 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-basil-400 focus:ring-2 focus:ring-basil-100"
                        />
                        {Array.from(draft).length > 1350 && <p className="mt-0.5 text-right text-[10px] text-slate-400">{Array.from(draft).length}/1500</p>}
                      </div>
                      <button
                        type="submit"
                        disabled={sending || (!draft.trim() && !attachment)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-600 text-white hover:bg-basil-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Gửi tin nhắn"
                      >
                        {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                      </button>
                    </div>
                    <p className="mt-1 pl-11 text-[10px] text-slate-400">Tệp ảnh, PDF, Word, Excel, CSV hoặc TXT · tối đa 20 MB</p>
                  </form>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 rounded-full bg-basil-50 p-4 text-basil-600"><MessageCircle size={28} /></div>
                <p className="font-medium text-ink">{isCashier ? 'Chọn một hội thoại để xem tin nhắn' : 'Bạn cần hỗ trợ?'}</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {isCashier ? 'Các hội thoại mới sẽ xuất hiện tự động trong hộp thư.' : 'Gửi câu hỏi cho quán, chúng tôi sẽ phản hồi sớm nhất có thể.'}
                </p>
                {!isCashier && cashiersOnline === false && (
                  <p className="mt-2 text-xs text-amber-700">Hiện chưa có thu ngân trực tuyến, quán sẽ trả lời bạn sớm.</p>
                )}
                {!isCashier && (
                  <form ref={formRef} onSubmit={sendMessage} className="mt-5 flex w-full max-w-lg items-end gap-2">
                    <label className="cursor-pointer rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" title="Đính kèm">
                      <Paperclip size={19} />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                        onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(Array.from(event.target.value).slice(0, 1500).join(''))}
                        maxLength={3000}
                        rows={1}
                        placeholder="Nhập tin nhắn đầu tiên..."
                        className="max-h-32 min-h-10 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-basil-400"
                      />
                      {attachment && <p className="mt-1 truncate text-xs text-slate-500">{attachment.name}</p>}
                    </div>
                    <button
                      type="submit"
                      disabled={sending || (!draft.trim() && !attachment)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-600 text-white hover:bg-basil-700 disabled:opacity-50"
                      aria-label="Gửi tin nhắn"
                    >
                      {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
