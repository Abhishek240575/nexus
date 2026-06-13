import { useState }        from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Loader2, Lock } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import Feed from '@/components/feed/Feed';

const commService = {
  getAll:     (q?: string) => api.get('/api/communities', { params: { q } }),
  getOne:     (slug: string) => api.get(`/api/communities/${slug}`),
  join:       (slug: string) => api.post(`/api/communities/${slug}/join`),
  create:     (data: any)   => api.post('/api/communities', data),
};

export default function Communities() {
  const { slug }       = useParams<{ slug?: string }>();
  const { user }       = useAuthStore();
  const queryClient    = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [search, setSearch] = useState('');

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['communities', search],
    queryFn:  () => commService.getAll(search || undefined),
    enabled:  !slug,
  });

  const { data: commData, isLoading: commLoading } = useQuery({
    queryKey: ['community', slug],
    queryFn:  () => commService.getOne(slug!),
    enabled:  !!slug,
  });

  const joinMutation = useMutation({
    mutationFn: (s: string) => commService.join(s),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => commService.create(data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setShowCreate(false);
      setForm({ name: '', slug: '', description: '' });
    },
  });

  // Single community view
  if (slug) {
    const comm = commData?.data?.data;
    if (commLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;
    if (!comm) return <div className="text-center py-12 text-gray-400">Community not found</div>;

    return (
      <div>
        <div className="h-24 bg-gradient-to-r from-brand to-purple-500" />
        <div className="px-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-end justify-between -mt-8 mb-3">
            <div className="w-16 h-16 rounded-xl bg-brand flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-black">
              {comm.name[0]}
            </div>
            {user && (
              <button
                onClick={() => joinMutation.mutate(slug)}
                disabled={joinMutation.isPending}
                className={`font-semibold px-4 py-1.5 rounded-full text-sm transition-colors ${
                  comm.is_member
                    ? 'border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:border-red-300 hover:text-red-500'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90'
                }`}>
                {joinMutation.isPending ? '…' : comm.is_member ? 'Joined' : 'Join'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{comm.name}</h1>
            {comm.is_private && <Lock size={14} className="text-gray-400" />}
          </div>
          <p className="text-gray-500 text-sm mb-2">c/{comm.slug} · {comm.members_count} members</p>
          {comm.description && <p className="text-sm text-gray-700 dark:text-gray-300">{comm.description}</p>}
        </div>
        <Feed type="profile" handle={slug} tab="community" />
      </div>
    );
  }

  // Community list view
  const communities = listData?.data?.data ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Communities</h1>
          {user && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors">
              <Plus size={14} /> New
            </button>
          )}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search communities…"
          className="w-full bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2 text-sm outline-none text-gray-900 dark:text-white placeholder-gray-400" />
      </div>

      {showCreate && (
        <div className="border-b border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Create community</h2>
          {[
            { key: 'name', placeholder: 'Community name' },
            { key: 'slug', placeholder: 'slug (letters, numbers, hyphens)' },
            { key: 'description', placeholder: 'Description (optional)' },
          ].map(({ key, placeholder }) => (
            <input key={key} value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          ))}
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.slug || createMutation.isPending}
              className="bg-brand text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {listLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {communities.length === 0 && !listLoading && (
        <div className="text-center py-16 text-gray-400">
          <Users size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">No communities yet</p>
          <p className="text-sm">Be the first to create one.</p>
        </div>
      )}

      {communities.map((c: any) => (
        <Link key={c.id} to={`/communities/${c.slug}`}
          className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold flex-shrink-0">
            {c.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{c.name}</p>
              {c.is_private && <Lock size={12} className="text-gray-400 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500">{c.members_count} members</p>
            {c.description && <p className="text-xs text-gray-400 truncate mt-0.5">{c.description}</p>}
          </div>
          {c.is_member && (
            <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full flex-shrink-0">Joined</span>
          )}
        </Link>
      ))}
    </div>
  );
}
