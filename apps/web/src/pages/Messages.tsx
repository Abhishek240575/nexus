import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link }  from 'react-router-dom';
import { Send, Loader2, ArrowLeft } from 'lucide-react';
import { messagesService }  from '@/services/notifications.service';
import { useAuthStore }     from '@/stores/auth.store';
import { getSocket }        from '@/services/socket';
import { formatDistanceToNowStrict } from 'date-fns';

export default function Messages() {
  const { id: conversationId } = useParams();
  const { user }       = useAuthStore();
  const queryClient    = useQueryClient();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const typingTimer    = useRef<any>(null);

  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn:  () => messagesService.getConversations(),
    staleTime: 1000 * 30,
  });
  const conversations = convsData?.data?.data ?? [];

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn:  () => conversationId ? messagesService.getMessages(conversationId) : null,
    enabled:  !!conversationId,
    staleTime: 0,
  });
  const messages = msgsData?.data?.data?.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesService.sendMessage(conversationId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setText('');
    },
  });

  // Socket events
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.emit('dm:join', conversationId);
    socket.on('dm:new_message', () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    });
    socket.on('dm:typing', (data: any) => {
      if (data.userId !== user?.id) setTyping(true);
    });
    socket.on('dm:stop_typing', () => setTyping(false));
    return () => {
      socket.emit('dm:leave', conversationId);
      socket.off('dm:new_message');
      socket.off('dm:typing');
      socket.off('dm:stop_typing');
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = (val: string) => {
    setText(val);
    const socket = getSocket();
    socket.emit('dm:typing', conversationId);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('dm:stop_typing', conversationId), 1500);
  };

  const handleSend = () => {
    if (!text.trim() || !conversationId) return;
    sendMutation.mutate(text.trim());
  };

  return (
    <div className="flex h-screen">
      {/* Conversation list */}
      <div className={`${conversationId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-100 dark:border-gray-800`}>
        <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
        </div>
        {convsLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>}
        {conversations.length === 0 && !convsLoading && (
          <div className="text-center py-12 text-gray-400 px-4">
            <p className="font-medium mb-1">No messages yet</p>
            <p className="text-sm">Start a conversation by visiting someone's profile.</p>
          </div>
        )}
        {conversations.map((c: any) => (
          <Link key={c.id} to={`/messages/${c.id}`}
            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 transition-colors ${conversationId === c.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
            <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.handle}&background=1d9bf0&color=fff&size=40`}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt={c.handle} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{c.display_name || c.handle}</p>
                {c.last_message_at && <p className="text-xs text-gray-400 flex-shrink-0">{formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: false })}</p>}
              </div>
              <p className="text-sm text-gray-500 truncate">{c.last_message || 'No messages yet'}</p>
            </div>
            {Number(c.unread_count) > 0 && (
              <span className="bg-brand text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{c.unread_count}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Message thread */}
      {conversationId ? (
        <div className="flex flex-col flex-1">
          <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
            <Link to="/messages" className="md:hidden p-1"><ArrowLeft size={20} /></Link>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Conversation</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgsLoading && <div className="flex justify-center"><Loader2 size={20} className="animate-spin text-brand" /></div>}
            {messages.map((m: any) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                    isMe ? 'bg-brand text-white rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                  }`}>
                    {m.content}
                    <p className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                      {formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: false })}
                    </p>
                  </div>
                </div>
              );
            })}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
            <input
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Start a message"
              className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 text-sm outline-none text-gray-900 dark:text-white placeholder-gray-400"
            />
            <button onClick={handleSend} disabled={!text.trim() || sendMutation.isPending}
              className="p-2 bg-brand text-white rounded-full disabled:opacity-50 transition-opacity hover:bg-brand-dark">
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Select a conversation</p>
            <p className="text-sm">Choose from your existing conversations.</p>
          </div>
        </div>
      )}
    </div>
  );
}
