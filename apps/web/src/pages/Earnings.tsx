import { useQuery } from '@tanstack/react-query';
import { Gift, TrendingUp, Loader2, Crown } from 'lucide-react';
import { api } from '@/services/api.client';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';

const tipsService = {
  getSummary: () => api.get('/api/monetization/tips/summary'),
};

export default function Earnings() {
  const { data, isLoading } = useQuery({ queryKey: ['tips-summary'], queryFn: tipsService.getSummary });
  const summary = data?.data?.data;

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Earnings</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Tips and support from your followers</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>
      )}

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
              <p className="text-sm text-gray-400 text-center py-8">No tips received yet. Share great content to start earning!</p>
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

          <div className="px-4 py-6 mt-2 border-t border-gray-100 dark:border-gray-800">
            <Link to="/premium" className="flex items-center justify-center gap-2 text-sm text-brand hover:underline font-medium">
              <Crown size={14} /> Unlock paid follower subscriptions with Pro
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
