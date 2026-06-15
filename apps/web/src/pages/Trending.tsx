import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, Flame, Hash, Users, Heart, Eye, Plus, Loader2, Zap, BarChart2 } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';

const narrativeService = {
  getTrending:     (region: string) => api.get('/api/narrative/trending', { params: { region, limit: 30 } }),
  getHashtagStats: (tag: string)    => api.get(`/api/narrative/hashtag/${tag}`),
  getCampaigns:    ()               => api.get('/api/narrative/campaigns'),
  createCampaign:  (data: any)      => api.post('/api/narrative/campaigns', data),
  supportCampaign: (id: string)     => api.post(`/api/narrative/campaigns/${id}/support`),
  getPinned:       ()               => api.get('/api/narrative/pinned'),
};

const REGIONS = ['national', 'north', 'south', 'east', 'west', 'northeast'];

function TrendingTab({ region }: { region: string }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey:        ['trending-topics', region],
    queryFn:         () => narrativeService.getTrending(region),
    refetchInterval: 60000,
    staleTime:       30000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['hashtag-stats', selectedTag],
    queryFn:  () => narrativeService.getHashtagStats(selectedTag!),
    enabled:  !!selectedTag,
  });

  const topics  = data?.data?.data ?? [];
  const stats   = statsData?.data?.data;
  const maxCount = Math.max(...topics.map((t: any) => t.post_count), 1);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      {/* Trending list */}
      <div className="border-r border-gray-100 dark:border-gray-800">
        {topics.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
            <p>No trending topics yet</p>
            <p className="text-sm mt-1">Start posting with hashtags!</p>
          </div>
        ) : topics.map((topic: any, i: number) => (
          <div key={topic.hashtag}
            onClick={() => setSelectedTag(selectedTag === topic.hashtag ? null : topic.hashtag)}
            className={`px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
              selectedTag === topic.hashtag ? 'bg-brand/5 border-l-2 border-l-brand' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold w-6 ${i < 3 ? 'text-brand' : 'text-gray-400'}`}>{i + 1}</span>
                <div>
                  <Link to={`/hashtag/${topic.hashtag}`}
                    onClick={e => e.stopPropagation()}
                    className="font-bold text-gray-900 dark:text-white hover:text-brand transition-colors">
                    #{topic.hashtag}
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{topic.post_count.toLocaleString()} posts</span>
                    {topic.posts_last_hour > 0 && (
                      <span className="flex items-center gap-0.5 text-orange-500">
                        <Flame size={10} />{topic.posts_last_hour}/hr
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {i < 3 && <Zap size={14} className="text-brand" />}
            </div>
            <div className="ml-9">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${(topic.post_count / maxCount) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hashtag detail panel */}
      <div className="px-4 py-4">
        {!selectedTag ? (
          <div className="text-center py-16 text-gray-400">
            <Hash size={32} className="mx-auto mb-3 opacity-30" />
            <p>Click a hashtag to see details</p>
          </div>
        ) : !stats ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">#{stats.hashtag}</h2>
              <Link to={`/hashtag/${stats.hashtag}`}
                className="text-xs text-brand hover:underline">View posts →</Link>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { icon: Hash,     label: 'Total posts',    value: Number(stats.stats?.total_posts || 0).toLocaleString() },
                { icon: Users,    label: 'Contributors',   value: Number(stats.stats?.unique_authors || 0).toLocaleString() },
                { icon: Heart,    label: 'Total likes',    value: Number(stats.stats?.total_likes || 0).toLocaleString() },
                { icon: Eye,      label: 'Total views',    value: Number(stats.stats?.total_views || 0).toLocaleString() },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3">
                  <Icon size={14} className="text-brand mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Velocity */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-orange-500" />
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Velocity</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">{Number(stats.stats?.posts_last_hour || 0)}<span className="text-sm font-normal ml-1">posts/hr</span></p>
              <p className="text-xs text-orange-500 mt-0.5">{Number(stats.stats?.posts_last_24h || 0)} in last 24 hours</p>
            </div>

            {/* Active campaign */}
            {stats.campaign && (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 mb-4">
                <p className="text-xs font-medium text-brand mb-1">🎯 Active Campaign</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.campaign.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stats.campaign.supporter_count} supporters</p>
              </div>
            )}

            {/* Top contributors */}
            {stats.top_users?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Top contributors</p>
                {stats.top_users.map((u: any) => (
                  <Link key={u.handle} to={`/${u.handle}`}
                    className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30 -mx-4 px-4 transition-colors">
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.handle}&background=1d9bf0&color=fff&size=32`}
                      className="w-8 h-8 rounded-full" alt={u.handle} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.display_name || u.handle}</p>
                      <p className="text-xs text-gray-400">@{u.handle}</p>
                    </div>
                    <span className="text-xs font-medium text-brand">{u.post_count} posts</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignsTab() {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    hashtag: '', title: '', description: '', goal: '',
    category: 'general', ends_hours: 168,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  () => narrativeService.getCampaigns(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => narrativeService.createCampaign(data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreate(false);
      setForm({ hashtag: '', title: '', description: '', goal: '', category: 'general', ends_hours: 168 });
    },
  });

  const supportMutation = useMutation({
    mutationFn: (id: string) => narrativeService.supportCampaign(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const campaigns = data?.data?.data ?? [];

  return (
    <div>
      {user && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors">
            <Plus size={14} /> Launch Campaign
          </button>
        </div>
      )}

      {showCreate && (
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Launch a Hashtag Campaign</h3>
          <input value={form.hashtag} onChange={e => setForm(f => ({ ...f, hashtag: e.target.value }))}
            placeholder="#YourHashtag"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Campaign title"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What is this campaign about?" rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
          <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
            placeholder="Campaign goal (e.g. 10,000 posts)"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
              {['general','politics','social','environment','economy','human rights','education'].map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select value={form.ends_hours} onChange={e => setForm(f => ({ ...f, ends_hours: Number(e.target.value) }))}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
              <option value={720}>30 days</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)}
              disabled={!form.hashtag || !form.title || createMutation.isPending}
              className="bg-brand text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {createMutation.isPending ? 'Launching…' : '🚀 Launch'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {campaigns.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <Zap size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No active campaigns</p>
          <p className="text-sm">Launch a hashtag campaign to mobilize people around a cause.</p>
        </div>
      )}

      {campaigns.map((campaign: any) => (
        <div key={campaign.id} className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <Link to={`/hashtag/${campaign.hashtag}`}
                className="text-brand font-bold text-lg hover:underline">#{campaign.hashtag}</Link>
              <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{campaign.title}</p>
              {campaign.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>}
              {campaign.goal && (
                <p className="text-xs text-gray-400 mt-1">🎯 Goal: {campaign.goal}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={10} />{campaign.supporter_count} supporters</span>
              <span className="flex items-center gap-1"><Hash size={10} />{campaign.post_count} posts</span>
              {campaign.ends_at && (
                <span className="flex items-center gap-1">⏱ {formatDistanceToNowStrict(new Date(campaign.ends_at))} left</span>
              )}
            </div>
            {user && (
              <button onClick={() => supportMutation.mutate(campaign.id)}
                disabled={supportMutation.isPending}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  campaign.is_supporting
                    ? 'bg-brand text-white'
                    : 'border border-brand text-brand hover:bg-brand/10'
                }`}>
                {campaign.is_supporting ? '✓ Supporting' : 'Support'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Trending() {
  const [tab, setTab]       = useState<'trending' | 'campaigns'>('trending');
  const [region, setRegion] = useState('national');

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={20} className="text-brand" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Narrative Dashboard</h1>
        </div>
        <div className="flex gap-4 mb-3">
          {(['trending', 'campaigns'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors capitalize ${
                tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
              }`}>{t === 'trending' ? '🔥 Trending' : '🚀 Campaigns'}</button>
          ))}
        </div>
        {tab === 'trending' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {REGIONS.map(r => (
              <button key={r} onClick={() => setRegion(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap flex-shrink-0 transition-colors ${
                  region === r ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>{r}</button>
            ))}
          </div>
        )}
      </div>

      {tab === 'trending' && <TrendingTab region={region} />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  );
}
