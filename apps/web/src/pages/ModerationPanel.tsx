import { useState }     from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Check, X, AlertTriangle, Loader2, Ban, Eye } from 'lucide-react';
import { api }          from '@/services/api.client';
import { formatDistanceToNowStrict } from 'date-fns';

const moderationService = {
  getQueue:  (status: string) => api.get('/api/moderation/queue', { params: { status } }),
  getStats:  ()               => api.get('/api/moderation/stats'),
  review:    (id: string, action: string, note?: string) =>
    api.post(`/api/moderation/queue/${id}/review`, { action, note }),
  banUser:   (userId: string, reason: string, permanent: boolean, duration_days: number) =>
    api.post(`/api/moderation/users/${userId}/ban`, { reason, permanent, duration_days }),
};

const decisionColor: Record<string, string> = {
  PASS:  'bg-green-100 text-green-700',
  WARN:  'bg-yellow-100 text-yellow-700',
  FLAG:  'bg-orange-100 text-orange-700',
  BLOCK: 'bg-red-100 text-red-700',
};

export default function ModerationPanel() {
  const [tab, setTab]       = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote]     = useState('');
  const [banReason, setBanReason] = useState('');
  const [showBan, setShowBan]     = useState(false);
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ['mod-stats'],
    queryFn:  () => moderationService.getStats(),
    refetchInterval: 30000,
  });
  const stats = statsData?.data?.data;

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['mod-queue', tab],
    queryFn:  () => moderationService.getQueue(tab),
    staleTime: 0,
  });
  const queue = queueData?.data?.data ?? [];

  const reviewMutation = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      moderationService.review(selected.id, action, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-queue'] });
      queryClient.invalidateQueries({ queryKey: ['mod-stats'] });
      setSelected(null);
      setNote('');
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ permanent, days }: { permanent: boolean; days: number }) =>
      moderationService.banUser(selected.user_id, banReason, permanent, days),
    onSuccess: () => {
      setShowBan(false);
      setBanReason('');
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Shield size={24} className="text-brand" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Moderation Panel</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Pending',   value: stats.pending_reviews, color: 'text-orange-500' },
              { label: 'Flagged 24h', value: stats.flagged_24h,  color: 'text-red-500' },
              { label: 'Approved',  value: stats.total_approved,  color: 'text-green-500' },
              { label: 'Rejected',  value: stats.total_rejected,  color: 'text-gray-500' },
              { label: 'Banned',    value: stats.banned_users,    color: 'text-red-600' },
              { label: 'Pending Posts', value: stats.pending_posts, color: 'text-yellow-500' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl p-3 text-center shadow-sm">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Queue */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              {(['pending', 'approved', 'rejected'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'text-brand border-b-2 border-brand' : 'text-gray-500'
                  }`}>{t}</button>
              ))}
            </div>

            {isLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>}

            {queue.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-400">
                <Shield size={32} className="mx-auto mb-2 opacity-30" />
                <p>No {tab} items</p>
              </div>
            )}

            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {queue.map((item: any) => (
                <div key={item.id}
                  onClick={() => setSelected(item)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selected?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${decisionColor[item.ai_decision]}`}>
                        {item.ai_decision}
                      </span>
                      <span className="text-xs text-gray-500">@{item.author_handle}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{item.content}</p>
                  {item.ai_reason && (
                    <p className="text-xs text-red-500 mt-1 truncate">⚠ {item.ai_reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Review panel */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <Eye size={32} className="mb-2 opacity-30" />
                <p>Select a post to review</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Review Post</h2>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {/* Post content */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">@{selected.author_handle}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${decisionColor[selected.ai_decision]}`}>{selected.ai_decision}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">{selected.content}</p>
                </div>

                {/* AI analysis */}
                {selected.ai_reason && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-4">
                    <p className="text-xs font-medium text-red-600 mb-1">AI Analysis</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{selected.ai_reason}</p>
                    {selected.ai_categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selected.ai_categories.map((c: string) => (
                          <span key={c} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reviewer note */}
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Add review note (optional)..."
                  rows={2}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none mb-3" />

                {/* Actions */}
                {tab === 'pending' && (
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => reviewMutation.mutate({ action: 'approve' })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => reviewMutation.mutate({ action: 'warn' })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
                      <AlertTriangle size={14} /> Warn
                    </button>
                    <button onClick={() => reviewMutation.mutate({ action: 'reject' })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}

                {/* Ban user */}
                <button onClick={() => setShowBan(b => !b)}
                  className="w-full flex items-center justify-center gap-1.5 border border-red-300 text-red-500 hover:bg-red-50 py-2 rounded-full text-sm font-medium transition-colors">
                  <Ban size={14} /> Ban @{selected.author_handle}
                </button>

                {showBan && (
                  <div className="mt-3 space-y-2">
                    <input value={banReason} onChange={e => setBanReason(e.target.value)}
                      placeholder="Ban reason..."
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => banMutation.mutate({ permanent: false, days: 7 })}
                        disabled={!banReason || banMutation.isPending}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-full text-xs font-medium disabled:opacity-50">
                        7-day ban
                      </button>
                      <button onClick={() => banMutation.mutate({ permanent: false, days: 30 })}
                        disabled={!banReason || banMutation.isPending}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-full text-xs font-medium disabled:opacity-50">
                        30-day ban
                      </button>
                      <button onClick={() => banMutation.mutate({ permanent: true, days: 0 })}
                        disabled={!banReason || banMutation.isPending}
                        className="flex-1 bg-red-800 hover:bg-red-900 text-white py-1.5 rounded-full text-xs font-medium disabled:opacity-50">
                        Permanent
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
