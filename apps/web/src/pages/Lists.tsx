import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Plus, Lock, Globe, Users, Loader2, X, UserPlus, Trash2 } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import PostCard from '@/components/post/PostCard';

const listsService = {
  getAll:       ()           => api.get('/api/lists'),
  getOne:       (id: string) => api.get(`/api/lists/${id}`),
  getFeed:      (id: string) => api.get(`/api/lists/${id}/feed`),
  getMembers:   (id: string) => api.get(`/api/lists/${id}/members`),
  getUserLists: (handle: string) => api.get(`/api/lists/user/${handle}`),
  create:       (data: any)  => api.post('/api/lists', data),
  update:       (id: string, data: any) => api.patch(`/api/lists/${id}`, data),
  delete:       (id: string) => api.delete(`/api/lists/${id}`),
  addMember:    (id: string, user_id: string) => api.post(`/api/lists/${id}/members`, { user_id }),
  removeMember: (id: string, userId: string)  => api.delete(`/api/lists/${id}/members/${userId}`),
  follow:       (id: string) => api.post(`/api/lists/${id}/follow`),
};

function ListDetail({ id }: { id: string }) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'feed' | 'members'>('feed');
  const [addHandle, setAddHandle] = useState('');

  const { data: listData } = useQuery({ queryKey: ['list', id], queryFn: () => listsService.getOne(id) });
  const { data: feedData } = useQuery({ queryKey: ['list-feed', id], queryFn: () => listsService.getFeed(id), enabled: tab === 'feed' });
  const { data: membersData } = useQuery({ queryKey: ['list-members', id], queryFn: () => listsService.getMembers(id), enabled: tab === 'members' });

  const followMutation = useMutation({
    mutationFn: () => listsService.follow(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['list', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => listsService.delete(id),
    onSuccess:  () => window.history.back(),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (handle: string) => {
      const { data } = await api.get(`/api/users/${handle}`);
      return listsService.addMember(id, data.data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-members', id] });
      setAddHandle('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => listsService.removeMember(id, userId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['list-members', id] }),
  });

  const list    = listData?.data?.data;
  const feed    = feedData?.data?.data ?? [];
  const members = membersData?.data?.data ?? [];
  const isOwner = user?.handle === list?.owner_handle;

  if (!list) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-4">
        <Link to="/lists" className="text-brand text-sm hover:underline mb-3 block">← All Lists</Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{list.name}</h1>
              {list.is_private ? <Lock size={14} className="text-gray-400" /> : <Globe size={14} className="text-gray-400" />}
            </div>
            {list.description && <p className="text-sm text-gray-500 mb-2">{list.description}</p>}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Link to={`/${list.owner_handle}`} className="hover:text-brand">by @{list.owner_handle}</Link>
              <span>{list.member_count} members</span>
              <span>{list.follower_count} followers</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!isOwner && (
              <button onClick={() => followMutation.mutate()}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  list.is_following ? 'border border-gray-300 text-gray-700 dark:text-gray-300' : 'bg-brand text-white hover:bg-brand-dark'
                }`}>
                {list.is_following ? 'Following' : 'Follow'}
              </button>
            )}
            {isOwner && (
              <button onClick={() => { if (confirm('Delete this list?')) deleteMutation.mutate(); }}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Add member (owner only) */}
        {isOwner && (
          <div className="flex gap-2 mt-3">
            <input value={addHandle} onChange={e => setAddHandle(e.target.value)}
              placeholder="Add @username to list"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
            <button onClick={() => addHandle && addMemberMutation.mutate(addHandle.replace('@', ''))}
              disabled={!addHandle || addMemberMutation.isPending}
              className="bg-brand text-white px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50">
              Add
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mt-3">
          {(['feed', 'members'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium pb-1 border-b-2 capitalize transition-colors ${
                tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        feed.length === 0
          ? <div className="text-center py-12 text-gray-400 text-sm">No posts from list members yet</div>
          : feed.map((post: any) => <PostCard key={post.id} post={post} />)
      )}

      {/* Members */}
      {tab === 'members' && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.length === 0
            ? <div className="text-center py-12 text-gray-400 text-sm">No members yet</div>
            : members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/${member.handle}`}>
                  <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.handle}&background=1d9bf0&color=fff&size=40`}
                    className="w-10 h-10 rounded-full" alt={member.handle} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/${member.handle}`} className="font-semibold text-sm text-gray-900 dark:text-white hover:underline">
                    {member.display_name || member.handle}
                  </Link>
                  <p className="text-xs text-gray-500">@{member.handle}</p>
                  {member.bio && <p className="text-xs text-gray-500 truncate mt-0.5">{member.bio}</p>}
                </div>
                {isOwner && (
                  <button onClick={() => removeMemberMutation.mutate(member.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function Lists() {
  const { id }      = useParams<{ id?: string }>();
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_private: false });

  const { data, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn:  () => listsService.getAll(),
    enabled:  !id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => listsService.create(data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowCreate(false);
      setForm({ name: '', description: '', is_private: false });
    },
  });

  if (id) return <ListDetail id={id} />;

  const lists = data?.data?.data ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List size={20} className="text-brand" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Lists</h1>
          </div>
          {user && (
            <button onClick={() => setShowCreate(s => !s)}
              className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors">
              <Plus size={14} /> New List
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-4 bg-gray-50 dark:bg-gray-900/30 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Create a List</h2>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="List name" maxLength={100}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" rows={2} maxLength={300}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_private} onChange={e => setForm(f => ({ ...f, is_private: e.target.checked }))}
              className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Lock size={12} /> Private list
            </span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
              className="bg-brand text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {createMutation.isPending ? 'Creating…' : 'Create List'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {lists.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <List size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No lists yet</p>
          <p className="text-sm">Create a list to curate posts from specific people.</p>
        </div>
      )}

      {lists.map((list: any) => (
        <Link key={list.id} to={`/lists/${list.id}`}
          className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
          <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
            {list.is_private ? <Lock size={20} className="text-brand" /> : <List size={20} className="text-brand" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{list.name}</p>
              {list.is_private && <Lock size={11} className="text-gray-400" />}
            </div>
            {list.description && <p className="text-xs text-gray-500 truncate">{list.description}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span className="flex items-center gap-1"><Users size={10} />{list.member_count} members</span>
              <span>by @{list.owner_handle}</span>
            </div>
          </div>
          {list.is_following && (
            <span className="text-xs text-brand font-medium">Following</span>
          )}
        </Link>
      ))}
    </div>
  );
}
