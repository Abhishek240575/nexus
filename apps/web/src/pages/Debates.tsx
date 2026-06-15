import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Swords, ThumbsUp, ThumbsDown, Plus, Loader2, Clock, Users, MessageSquare, Heart } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';

const debatesService = {
  getAll:        (category?: string) => api.get('/api/debates', { params: { category } }),
  getOne:        (id: string)        => api.get(`/api/debates/${id}`),
  getArguments:  (id: string, side?: string) => api.get(`/api/debates/${id}/arguments`, { params: { side } }),
  create:        (data: any)         => api.post('/api/debates', data),
  vote:          (id: string, side: string) => api.post(`/api/debates/${id}/vote`, { side }),
  addArgument:   (id: string, data: any) => api.post(`/api/debates/${id}/arguments`, data),
  likeArgument:  (argumentId: string) => api.post(`/api/debates/arguments/${argumentId}/like`),
  close:         (id: string)        => api.patch(`/api/debates/${id}/close`),
};

const CATEGORIES = ['all', 'politics', 'social', 'economy', 'environment', 'technology', 'culture', 'religion'];

const categoryColor: Record<string, string> = {
  politics: 'bg-blue-100 text-blue-700',
  social: 'bg-purple-100 text-purple-700',
  economy: 'bg-green-100 text-green-700',
  environment: 'bg-emerald-100 text-emerald-700',
  technology: 'bg-cyan-100 text-cyan-700',
  culture: 'bg-orange-100 text-orange-700',
  religion: 'bg-yellow-100 text-yellow-700',
  general: 'bg-gray-100 text-gray-700',
};

function ArgumentCard({ arg, onLike }: { arg: any; onLike: (id: string) => void }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <img src={arg.author_avatar || `https://ui-avatars.com/api/?name=${arg.author_handle}&background=1d9bf0&color=fff&size=28`}
          className="w-7 h-7 rounded-full" alt={arg.author_handle} />
        <div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{arg.author_name || arg.author_handle}</span>
          <span className="text-xs text-gray-400 ml-2">{formatDistanceToNowStrict(new Date(arg.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{arg.content}</p>
      <button onClick={() => onLike(arg.id)}
        className={`flex items-center gap-1 text-xs transition-colors ${arg.is_liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
        <Heart size={12} fill={arg.is_liked ? 'currentColor' : 'none'} />
        {arg.likes_count}
      </button>
    </div>
  );
}

function DebateDetail({ id }: { id: string }) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [argContent, setArgContent] = useState('');
  const [argSide, setArgSide]       = useState<'for' | 'against'>('for');
  const [activeTab, setActiveTab]   = useState<'all' | 'for' | 'against'>('all');

  const { data: debateData, isLoading } = useQuery({
    queryKey: ['debate', id],
    queryFn:  () => debatesService.getOne(id),
  });

  const { data: argsData } = useQuery({
    queryKey: ['debate-args', id, activeTab],
    queryFn:  () => debatesService.getArguments(id, activeTab === 'all' ? undefined : activeTab),
  });

  const voteMutation = useMutation({
    mutationFn: (side: string) => debatesService.vote(id, side),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['debate', id] }),
  });

  const argMutation = useMutation({
    mutationFn: (data: any) => debatesService.addArgument(id, data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['debate-args', id] });
      queryClient.invalidateQueries({ queryKey: ['debate', id] });
      setArgContent('');
    },
  });

  const likeMutation = useMutation({
    mutationFn: (argumentId: string) => debatesService.likeArgument(argumentId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['debate-args', id] }),
  });

  const debate = debateData?.data?.data;
  const args   = argsData?.data?.data ?? [];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;
  if (!debate)   return <div className="text-center py-12 text-gray-400">Debate not found</div>;

  const total      = debate.for_votes + debate.against_votes;
  const forPct     = total > 0 ? Math.round((debate.for_votes / total) * 100) : 50;
  const againstPct = 100 - forPct;
  const isOpen     = debate.status === 'open';

  return (
    <div>
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <Link to="/debates" className="text-brand text-sm hover:underline mb-2 block">← All Debates</Link>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{debate.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        {debate.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{debate.description}</p>}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1"><Users size={12} />{total} votes</span>
          <span className="flex items-center gap-1"><MessageSquare size={12} />{debate.total_arguments} arguments</span>
          <span className={`px-2 py-0.5 rounded-full capitalize ${categoryColor[debate.category] || categoryColor.general}`}>{debate.category}</span>
        </div>

        {/* Vote bars */}
        <div className="mb-4">
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-green-600">{debate.for_label} {forPct}%</span>
            <span className="text-red-500">{debate.against_label} {againstPct}%</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${againstPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{debate.for_votes} votes</span>
            <span>{debate.against_votes} votes</span>
          </div>
        </div>

        {/* Vote buttons */}
        {user && isOpen && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => voteMutation.mutate('for')}
              disabled={voteMutation.isPending}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm transition-colors ${
                debate.my_vote === 'for'
                  ? 'bg-green-500 text-white'
                  : 'border-2 border-green-500 text-green-600 hover:bg-green-50'
              }`}>
              <ThumbsUp size={16} /> {debate.for_label}
            </button>
            <button onClick={() => voteMutation.mutate('against')}
              disabled={voteMutation.isPending}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm transition-colors ${
                debate.my_vote === 'against'
                  ? 'bg-red-500 text-white'
                  : 'border-2 border-red-500 text-red-500 hover:bg-red-50'
              }`}>
              <ThumbsDown size={16} /> {debate.against_label}
            </button>
          </div>
        )}

        {/* Add argument */}
        {user && isOpen && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-3">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setArgSide('for')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${argSide === 'for' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                Argue For
              </button>
              <button onClick={() => setArgSide('against')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${argSide === 'against' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                Argue Against
              </button>
            </div>
            <textarea value={argContent} onChange={e => setArgContent(e.target.value)}
              placeholder={`Make your argument ${argSide === 'for' ? 'for' : 'against'}...`}
              rows={2} maxLength={500}
              className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand resize-none text-gray-900 dark:text-white mb-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{500 - argContent.length} chars left</span>
              <button onClick={() => argMutation.mutate({ content: argContent, side: argSide })}
                disabled={!argContent.trim() || argMutation.isPending}
                className="bg-brand text-white px-4 py-1.5 rounded-full text-xs font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
                {argMutation.isPending ? 'Posting…' : 'Post argument'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Arguments */}
      <div className="px-4 py-3">
        <div className="flex gap-2 mb-4">
          {(['all', 'for', 'against'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                activeTab === t
                  ? t === 'for' ? 'bg-green-500 text-white' : t === 'against' ? 'bg-red-500 text-white' : 'bg-brand text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>{t === 'all' ? 'All Arguments' : t === 'for' ? `For (${debate.for_votes})` : `Against (${debate.against_votes})`}</button>
          ))}
        </div>

        {args.length === 0
          ? <p className="text-center text-gray-400 py-8 text-sm">No arguments yet — be the first!</p>
          : args.map((arg: any) => (
            <ArgumentCard key={arg.id} arg={arg} onLike={(id) => likeMutation.mutate(id)} />
          ))
        }
      </div>
    </div>
  );
}

export default function Debates() {
  const { id }      = useParams<{ id?: string }>();
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [category, setCategory]   = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', category: 'general',
    for_label: 'For', against_label: 'Against', closes_hours: 24,
  });

  const { data: debatesData, isLoading } = useQuery({
    queryKey: ['debates', category],
    queryFn:  () => debatesService.getAll(category === 'all' ? undefined : category),
    enabled:  !id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => debatesService.create(data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['debates'] });
      setShowCreate(false);
      setForm({ title: '', description: '', category: 'general', for_label: 'For', against_label: 'Against', closes_hours: 24 });
    },
  });

  if (id) return <DebateDetail id={id} />;

  const debates = debatesData?.data?.data ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Swords size={20} className="text-brand" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Debates</h1>
          </div>
          {user && (
            <button onClick={() => setShowCreate(s => !s)}
              className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors">
              <Plus size={14} /> New Debate
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors flex-shrink-0 ${
                category === c ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="border-b border-gray-100 dark:border-gray-800 p-4 space-y-3 bg-gray-50 dark:bg-gray-900/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">Create a Debate</h2>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Debate topic (e.g. Should India have a uniform civil code?)"
            maxLength={280}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Add context or background (optional)"
            rows={2} maxLength={1000}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.for_label} onChange={e => setForm(f => ({ ...f, for_label: e.target.value }))}
              placeholder="For label"
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
            <input value={form.against_label} onChange={e => setForm(f => ({ ...f, against_label: e.target.value }))}
              placeholder="Against label"
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select value={form.closes_hours} onChange={e => setForm(f => ({ ...f, closes_hours: Number(e.target.value) }))}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
              <option value={24}>Closes in 24h</option>
              <option value={48}>Closes in 48h</option>
              <option value={72}>Closes in 72h</option>
              <option value={168}>Closes in 7 days</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim() || createMutation.isPending}
              className="bg-brand text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {createMutation.isPending ? 'Creating…' : 'Start Debate'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {debates.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <Swords size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No debates yet</p>
          <p className="text-sm">Start a debate on any political or social topic.</p>
        </div>
      )}

      {debates.map((debate: any) => {
        const total      = debate.for_votes + debate.against_votes;
        const forPct     = total > 0 ? Math.round((debate.for_votes / total) * 100) : 50;
        const againstPct = 100 - forPct;
        return (
          <Link key={debate.id} to={`/debates/${debate.id}`}
            className="block px-4 py-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-semibold text-gray-900 dark:text-white leading-snug flex-1">{debate.title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${categoryColor[debate.category] || categoryColor.general}`}>
                {debate.category}
              </span>
            </div>
            {debate.description && (
              <p className="text-sm text-gray-500 mb-2 line-clamp-2">{debate.description}</p>
            )}
            <div className="flex h-2 rounded-full overflow-hidden mb-1">
              <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} />
              <div className="bg-red-500 transition-all" style={{ width: `${againstPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span className="text-green-600 font-medium">{debate.for_label} {forPct}%</span>
                <span className="text-red-500 font-medium">{debate.against_label} {againstPct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Users size={10} />{total}</span>
                <span className="flex items-center gap-1"><MessageSquare size={10} />{debate.total_arguments}</span>
                <span className="flex items-center gap-1"><Clock size={10} />{formatDistanceToNowStrict(new Date(debate.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
