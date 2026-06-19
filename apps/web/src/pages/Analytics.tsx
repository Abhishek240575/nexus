import { useState }     from 'react';
import { useQuery }     from '@tanstack/react-query';
import { BarChart2, TrendingUp, Heart, Repeat2, MessageCircle, Eye, Users, Loader2 } from 'lucide-react';
import { api }          from '@/services/api.client';
import { Link }         from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';

const analyticsService = {
  getPosts:    (days: number) => api.get('/api/analytics/posts',    { params: { days } }),
  getProfile:  ()             => api.get('/api/analytics/profile'),
  getHashtags: ()             => api.get('/api/analytics/hashtags'),
};

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center mb-3`}>
        <Icon size={16} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{Number(value).toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(28);
  const [tab,  setTab]  = useState<'posts' | 'audience' | 'hashtags'>('posts');

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['analytics-posts', days],
    queryFn:  () => analyticsService.getPosts(days),
    staleTime: 1000 * 60 * 5,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['analytics-profile'],
    queryFn:  () => analyticsService.getProfile(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: hashtagData } = useQuery({
    queryKey: ['analytics-hashtags'],
    queryFn:  () => analyticsService.getHashtags(),
    staleTime: 1000 * 60 * 5,
  });

  const posts    = postsData?.data?.data;
  const profile  = profileData?.data?.data;
  const hashtags = hashtagData?.data?.data?.hashtags ?? hashtagData?.data?.data ?? [];

  const isAdvanced = posts?.tier && posts.tier !== 'free';
  const isPro      = posts?.tier && ['pro', 'enterprise'].includes(posts.tier);
  const maxImpressions = Math.max(...(posts?.daily_breakdown ?? []).map((d: any) => Number(d.impressions)), 1);

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
            <option value={7}>Last 7 days</option>
            <option value={28}>Last 28 days</option>
            {isAdvanced && <option value={90}>Last 90 days</option>}
            {isPro && <option value={365}>Last 365 days</option>}
          </select>
        </div>
        <div className="flex gap-4 mt-3">
          {(['posts', 'audience', 'hashtags'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors capitalize ${
                tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">

        {/* Posts tab */}
        {tab === 'posts' && (
          <>
            {postsLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-brand" /></div> : (
              <>
                {/* Upgrade nudge for free users */}
                {posts?.upgrade_message && (
                  <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">You're on the Free plan</p>
                      <p className="text-xs text-gray-500">{posts.upgrade_message}</p>
                    </div>
                    <a href="/premium" className="flex-shrink-0 text-xs font-semibold text-brand hover:underline">Upgrade →</a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard icon={Eye}            label="Impressions"      value={posts?.totals?.total_impressions ?? 0}  color="bg-brand" />
                  <StatCard icon={Heart}          label="Likes"            value={posts?.totals?.total_likes ?? 0}        color="bg-pink-500" />
                  <StatCard icon={Repeat2}        label="Reposts"          value={posts?.totals?.total_reposts ?? 0}      color="bg-green-500" />
                  <StatCard icon={MessageCircle}  label="Replies"          value={posts?.totals?.total_replies ?? 0}      color="bg-purple-500" />
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Engagement rate</p>
                    <p className="text-2xl font-bold text-brand">{posts?.totals?.engagement_rate ?? '0.00'}%</p>
                  </div>
                  <p className="text-xs text-gray-400">(likes + reposts + replies) / impressions</p>
                </div>

                {/* Reach estimate — Pro+ only */}
                {posts?.reach_estimate && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Estimated reach</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-lg font-bold text-gray-900 dark:text-white">{Number(posts.reach_estimate.followers).toLocaleString()}</p><p className="text-xs text-gray-500">Followers</p></div>
                      <div><p className="text-lg font-bold text-gray-900 dark:text-white">{Number(posts.reach_estimate.estimated_reach).toLocaleString()}</p><p className="text-xs text-gray-500">Est. unique reach</p></div>
                      <div><p className="text-lg font-bold text-gray-900 dark:text-white">{Number(posts.reach_estimate.repost_amplification).toLocaleString()}</p><p className="text-xs text-gray-500">Repost amplification</p></div>
                    </div>
                  </div>
                )}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">Daily impressions</p>
                    <div className="flex items-end gap-1 h-20">
                      {(posts?.daily_breakdown ?? []).map((d: any, i: number) => {
                        const pct = maxImpressions > 0 ? (Number(d.impressions) / maxImpressions) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full bg-brand/20 rounded-t-sm relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                              <div className="absolute inset-x-0 bottom-0 bg-brand rounded-t-sm" style={{ height: '40%' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{days}-day trend</p>
                  </div>
                )}

                {/* Top posts */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top posts</p>
                  {(posts?.top_posts ?? []).map((p: any) => (
                    <Link key={p.id} to={`/post/${p.id}`}
                      className="block border border-gray-100 dark:border-gray-800 rounded-xl p-3 mb-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <p className="text-sm text-gray-900 dark:text-white truncate mb-2">{p.content || '(media post)'}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={12} />{Number(p.views_count).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Heart size={12} />{p.likes_count}</span>
                        <span className="flex items-center gap-1"><Repeat2 size={12} />{p.reposts_count}</span>
                        <span className="ml-auto">{formatDistanceToNowStrict(new Date(p.created_at), { addSuffix: true })}</span>
                      </div>
                    </Link>
                  ))}
                  {(posts?.top_posts ?? []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No posts yet in this period</p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Audience tab */}
        {tab === 'audience' && (
          <>
            {profileLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-brand" /></div> : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard icon={Users}    label="Total followers"   value={profile?.profile?.followers_count ?? 0}     color="bg-brand" />
                  <StatCard icon={TrendingUp} label="Following"       value={profile?.profile?.following_count ?? 0}     color="bg-purple-500" />
                  <StatCard icon={BarChart2} label="Total posts"      value={profile?.profile?.posts_count ?? 0}         color="bg-amber-500" />
                  <StatCard icon={Eye}       label="Profile views"    value={profile?.total_profile_views ?? 0}          color="bg-teal-500" />
                </div>

                {/* Follower growth chart */}
                {(profile?.follower_growth ?? []).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">Follower growth (30d)</p>
                    <div className="space-y-2">
                      {(profile?.follower_growth ?? []).slice(-7).map((d: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-20 flex-shrink-0">{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          <MiniBar value={Number(d.new_followers)} max={Math.max(...(profile?.follower_growth ?? []).map((x: any) => Number(x.new_followers)), 1)} color="bg-brand" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white w-6 text-right">+{d.new_followers}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent followers */}
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent followers</p>
                {(profile?.recent_followers ?? []).length === 0
                  ? <p className="text-sm text-gray-400 text-center py-4">No followers yet</p>
                  : (profile?.recent_followers ?? []).map((u: any) => (
                    <Link key={u.id} to={`/${u.handle}`}
                      className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30 -mx-4 px-4 transition-colors">
                      <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.handle}&background=1d9bf0&color=fff&size=36`}
                        className="w-9 h-9 rounded-full object-cover" alt={u.handle} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.display_name || u.handle}</p>
                        <p className="text-xs text-gray-500">@{u.handle}</p>
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0">{formatDistanceToNowStrict(new Date(u.created_at), { addSuffix: true })}</p>
                    </Link>
                  ))
                }
              </>
            )}
          </>
        )}

        {/* Hashtags tab */}
        {tab === 'hashtags' && (
          <>
            <p className="text-sm text-gray-500 mb-4">Your top hashtags by impressions (last 30 days)</p>
            {hashtags.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">No hashtag data yet — use hashtags in your posts!</p>
              : hashtags.map((h: any, i: number) => (
                <div key={h.name} className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className="text-sm font-medium text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link to={`/hashtag/${h.name}`} className="text-sm font-semibold text-brand hover:underline">#{h.name}</Link>
                    <p className="text-xs text-gray-400">{h.usage_count} posts · {Number(h.total_impressions).toLocaleString()} impressions</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Heart size={10} />{h.total_likes}
                  </div>
                </div>
              ))
            }
          </>
        )}

      </div>
    </div>
  );
}
