import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, TrendingUp, Loader2, Crown, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/services/api.client';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuthStore } from '@/stores/auth.store';

const earningsService = {
  getSummary:       () => api.get('/api/monetization/tips/summary'),
  getSubscribers:   () => api.get('/api/monetization/creator-sub/subscribers'),
  setupCreatorSub:  (data: any) => api.post('/api/monetization/creator-sub/setup', data),
};

export default function Earnings() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isPro = ['pro', 'enterprise'].includes(user?.premium_tier || '');

  const [tab, setTab] = useState<'tips' | 'subscriptions'>('tips');
  const [price, setPrice] = useState('99');
  const [enabled, setEnabled] = useState(false);
  const [setupMsg, setSetupMsg] = useState('');

  const { data: tipsData,    isLoading: tipsLoading    } = useQuery({ queryKey: ['tips-summary'],       queryFn: earningsService.getSummary });
  const { data: subsData,    isLoading: subsLoading    } = useQuery({ queryKey: ['my-subscribers'],     queryFn: earningsService.getSubscribers, enabled: isPro });

  const summary     = tipsData?.data?.data;
  const subsummary  = subsData?.data?.data;

  const setupMutation = useMutation({
    mutationFn: () => earningsService.setupCreatorSub({ enabled, price_inr: enabled ? Number(price) : 0 }),
    onSuccess:  () => {
      setSetupMsg(enabled ? `Subscriptions enabled at ₹${price}/month` : 'Subscriptions disabled');
      queryClient.invalidateQueries({ queryKey: ['my-subscribers'] });
      setTimeout(() => setSetupMsg(''), 3000);
    },
  });

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Earnings</h1>
        </div>
        <div className="flex gap-4 mt-3">
          {(['tips', 'subscriptions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium pb-1 border-b-2 capitalize transition-colors ${tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tips tab ── */}
      {tab === 'tips' && (
        <>
          {tipsLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}
          {summary && (
            <>
              <div className="grid grid-cols-2 gap-3 px-4 py-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{summary.total_amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Total tips received</p>
                </div>
                <div className="bg-brand/5 rounded-2xl p-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_tips}</p>
                  <p className="text-xs text-gray-500 mt-1">Number of tips</p>
                </div>
              </div>

              {summary.top_supporters?.length > 0 && (
                <div className="px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-amber-500" /> Top supporters
                  </h2>
                  <div className="space-y-2 mb-4">
                    {summary.top_supporters.map((s: any, i: number) => (
                      <Link key={s.handle} to={`/${s.handle}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                        <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                        <img src={s.avatar_url || `https://ui-avatars.com/api/?name=${s.handle}&background=1d9bf0&color=fff&size=32`}
                          className="w-8 h-8 rounded-full" alt={s.handle} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.display_name || s.handle}</p>
                          <p className="text-xs text-gray-500">@{s.handle}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-600">₹{(s.total_paise / 100).toLocaleString()}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Recent tips</h2>
                {summary.recent_tips?.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No tips received yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {summary.recent_tips?.map((tip: any) => (
                      <div key={tip.id} className="flex items-center gap-3 py-3">
                        <img src={tip.from_avatar || `https://ui-avatars.com/api/?name=${tip.from_handle}&background=1d9bf0&color=fff&size=36`}
                          className="w-9 h-9 rounded-full" alt={tip.from_handle} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">
                            <Link to={`/${tip.from_handle}`} className="font-medium hover:underline">@{tip.from_handle}</Link> sent a tip
                          </p>
                          {tip.message && <p className="text-xs text-gray-500 truncate mt-0.5">"{tip.message}"</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNowStrict(new Date(tip.created_at), { addSuffix: true })}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-600 flex-shrink-0">₹{(tip.amount_inr_paise / 100).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Subscriptions tab ── */}
      {tab === 'subscriptions' && (
        <div className="px-4 py-4">
          {!isPro ? (
            <div className="text-center py-12">
              <Crown size={36} className="mx-auto mb-3 text-amber-500" />
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">Creator subscriptions require Pro</p>
              <p className="text-sm text-gray-500 mb-5">Let your followers subscribe to your exclusive content for a monthly fee.</p>
              <Link to="/premium" className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-brand-dark">
                <Crown size={14} /> Upgrade to Pro
              </Link>
            </div>
          ) : (
            <>
              {/* Setup panel */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <Crown size={14} className="text-amber-500" /> Creator subscription settings
                </h2>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable paid subscriptions</span>
                  <button onClick={() => setEnabled(e => !e)} className="text-brand">
                    {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-gray-400" />}
                  </button>
                </div>
                {enabled && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">₹</span>
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="10"
                      className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                )}
                {setupMsg && <p className="text-xs text-green-500 mb-2">{setupMsg}</p>}
                <button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}
                  className="bg-brand text-white px-4 py-1.5 rounded-full text-xs font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
                  {setupMutation.isPending ? 'Saving…' : 'Save settings'}
                </button>
              </div>

              {/* Subscriber stats */}
              {subsLoading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand" /></div>}
              {subsummary && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{subsummary.monthly_revenue_inr.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Monthly revenue</p>
                    </div>
                    <div className="bg-brand/5 rounded-2xl p-4">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{subsummary.subscriber_count}</p>
                      <p className="text-xs text-gray-500 mt-1">Active subscribers</p>
                    </div>
                  </div>

                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Users size={14} className="text-brand" /> Your subscribers
                  </h2>
                  {subsummary.subscribers?.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No subscribers yet. Enable subscriptions and share exclusive content to attract paid followers.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {subsummary.subscribers?.map((s: any) => (
                        <div key={s.handle} className="flex items-center gap-3 py-3">
                          <img src={s.avatar_url || `https://ui-avatars.com/api/?name=${s.handle}&background=1d9bf0&color=fff&size=36`}
                            className="w-9 h-9 rounded-full" alt={s.handle} />
                          <div className="flex-1 min-w-0">
                            <Link to={`/${s.handle}`} className="text-sm font-medium text-gray-900 dark:text-white hover:underline">{s.display_name || s.handle}</Link>
                            <p className="text-xs text-gray-400">Renews {new Date(s.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className="text-sm font-semibold text-amber-600">₹{(s.price_inr_paise / 100)}/mo</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
