import { useState, useEffect } from 'react';
import { Search, Loader2 }    from 'lucide-react';
import { Link }               from 'react-router-dom';
import { useQuery }           from '@tanstack/react-query';
import Feed                   from '@/components/feed/Feed';
import { usersService }       from '@/services/posts.service';
import PostCard               from '@/components/post/PostCard';

export default function Explore() {
  const [q, setQ]       = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tab, setTab]   = useState<'posts' | 'users'>('posts');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['search', debouncedQ, tab],
    queryFn:  () => usersService.search(debouncedQ, tab),
    enabled:  debouncedQ.length >= 2,
    staleTime: 1000 * 30,
  });

  const results   = searchData?.data?.data;
  const isSearch  = debouncedQ.length >= 2;

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2 mb-3">
          <Search size={16} className="text-gray-500 flex-shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search Nexus"
            className="bg-transparent flex-1 text-sm outline-none text-gray-900 dark:text-white placeholder-gray-500" />
          {q && <button onClick={() => setQ('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
        </div>
        {isSearch && (
          <div className="flex gap-4">
            {(['posts', 'users'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors capitalize ${
                  tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
                }`}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {!isSearch && (
        <>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trending posts</h2>
          </div>
          <Feed type="explore" />
        </>
      )}

      {isSearch && searching && (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>
      )}

      {isSearch && !searching && tab === 'users' && (
        <div>
          {(results?.users ?? []).length === 0
            ? <div className="text-center py-12 text-gray-400">No users found</div>
            : (results?.users ?? []).map((u: any) => (
              <Link key={u.id} to={`/${u.handle}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.handle}&background=1d9bf0&color=fff&size=40`}
                  className="w-10 h-10 rounded-full object-cover" alt={u.handle} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{u.display_name || u.handle}</p>
                    {u.verified && <span className="text-brand text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-gray-500">@{u.handle} · {u.followers_count} followers</p>
                  {u.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{u.bio}</p>}
                </div>
              </Link>
            ))
          }
        </div>
      )}

      {isSearch && !searching && tab === 'posts' && (
        <div>
          {(results?.posts ?? []).length === 0
            ? <div className="text-center py-12 text-gray-400">No posts found</div>
            : (results?.posts ?? []).map((p: any) => <PostCard key={p.id} post={p} />)
          }
        </div>
      )}
    </div>
  );
}
