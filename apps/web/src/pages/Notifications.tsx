import { useEffect }           from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link }                from 'react-router-dom';
import { Heart, Repeat2, UserPlus, MessageCircle, AtSign, Loader2 } from 'lucide-react';
import { notificationsService } from '@/services/notifications.service';
import { useNotificationsStore } from '@/stores/notifications.store';
import { formatDistanceToNowStrict } from 'date-fns';

const typeIcon: Record<string, { icon: any; color: string; label: string }> = {
  like:    { icon: Heart,         color: 'text-pink-500',   label: 'liked your post' },
  repost:  { icon: Repeat2,       color: 'text-green-500',  label: 'reposted your post' },
  reply:   { icon: MessageCircle, color: 'text-brand',      label: 'replied to your post' },
  follow:  { icon: UserPlus,      color: 'text-purple-500', label: 'followed you' },
  mention: { icon: AtSign,        color: 'text-brand',      label: 'mentioned you' },
  quote:   { icon: Repeat2,       color: 'text-amber-500',  label: 'quoted your post' },
};

export default function Notifications() {
  const { reset }   = useNotificationsStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    notificationsService.markAllRead().catch(() => {});
    reset();
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey:         ['notifications'],
      queryFn:          ({ pageParam }) => notificationsService.getAll(pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: any) => last.data?.data?.next_cursor ?? undefined,
    });

  const notifications = data?.pages.flatMap((p: any) => p.data?.data?.data ?? []) ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {!isLoading && notifications.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-1">No notifications yet</p>
          <p className="text-sm">When someone likes or replies to your posts, you'll see it here.</p>
        </div>
      )}

      {notifications.map((n: any) => {
        const meta = typeIcon[n.type] || typeIcon['mention'];
        const Icon = meta.icon;
        return (
          <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
            <div className={`mt-1 flex-shrink-0 ${meta.color}`}><Icon size={20} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link to={`/${n.actor_handle}`}>
                  <img src={n.actor_avatar || `https://ui-avatars.com/api/?name=${n.actor_handle}&background=1d9bf0&color=fff&size=32`} className="w-8 h-8 rounded-full object-cover" alt={n.actor_handle} />
                </Link>
              </div>
              <p className="text-sm text-gray-900 dark:text-white">
                <Link to={`/${n.actor_handle}`} className="font-semibold hover:underline">{n.actor_name || n.actor_handle}</Link>{' '}
                <span className="text-gray-500">{meta.label}</span>
              </p>
              {n.post_content && <p className="text-sm text-gray-400 mt-0.5 truncate">{n.post_content}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          </div>
        );
      })}

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="text-brand text-sm hover:underline">
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
