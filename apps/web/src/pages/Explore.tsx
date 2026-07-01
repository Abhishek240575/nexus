import { useState } from 'react';
import { Search, Loader2, Hash, User, FileText } from 'lucide-react';
import { useQuery }  from '@tanstack/react-query';
import { Link }      from 'react-router-dom';
import { api }       from '@/services/api.client';
import { useDebounce } from '@/hooks/useDebounce';
import Feed           from '@/components/feed/Feed';
import VerifiedBadge  from '@/components/common/VerifiedBadge';

const searchService = {
  search: (q: string, type: string) =>
    api.get('/api/search', { params: { q, type, limit: 20 } }),
};

export default function Explore() {
  const [q,   setQ]   = useState('');
  const [tab, setTab] = useState<'all' | 'posts' | 'users' | 'hashtags'>('all');
  const debouncedQ    = useDebounce(q, 400);
  const isSearch      = debouncedQ.length >= 2;

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQ, tab],
    queryFn:  () => searchService.search(debouncedQ, tab),
    enabled:  isSearch,
  });

  const results = data?.data?.data;

  return (
    <div>
      {/* Search bar */}
      <div className="sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search Deemona"
            className="w-full bg-gray-100 dark:bg-gray-900 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              ×
            </button>
          )}
        </div>

        {/* Tabs */}
        {isSearch && (
          <div className="flex gap-4 mt-3">
            {(['all', 'posts', 'users', 'hashtags'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-sm font-medium pb-1 border-b-2 capitalize transition-colors ${tab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isSearch && isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand" />
        </div>
      )}

      {/* Results */}
      {isSearch && !isLoading && results && (
        <div className="divide-y divide-gray-50 dark:divide-gray-900">

          {/* AI expanded terms */}
          {results.expanded_terms?.length > 1 && (
            <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/10">
              <p className="text-xs text-purple-600 dark:text-purple-400">
                AI expanded: {results.expanded_terms.slice(1).join(', ')}
              </p>
            </div>
          )}

          {/* Users */}
          {(tab === 'all' || tab === 'users') && results.users?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User size={12} /> People
              </p>
              <div className="space-y-3">
                {results.users.map((u: any) => (
                  <Link key={u.id} to={`/${u.handle}`} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-900/30 -mx-2 px-2 py-1.5 rounded-xl transition-colors">
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.handle}&background=1d9bf0&color=fff&size=40`}
                      className="w-10 h-10 rounded-full" alt={u.handle} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{u.display_name || u.handle}</span>
                        {u.verified && <VerifiedBadge tier={u.premium_tier} size={14} />}
                      </div>
                      <p className="text-xs text-gray-500">@{u.handle} · {u.followers_count?.toLocaleString()} followers</p>
                      {u.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{u.bio}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {(tab === 'all' || tab === 'hashtags') && results.hashtags?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Hash size={12} /> Hashtags
              </p>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map((h: any) => (
                  <button key={h.hashtag} onClick={() => setQ(h.hashtag.replace('#',''))}
                    className="flex items-center gap-1.5 bg-brand/5 text-brand px-3 py-1.5 rounded-full text-sm hover:bg-brand/10 transition-colors">
                    <Hash size={12} />
                    {h.hashtag.replace('#','')}
                    <span className="text-xs text-gray-400 ml-1">{h.post_count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {(tab === 'all' || tab === 'posts') && results.posts?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-2 flex items-center gap-1.5">
                <FileText size={12} /> Posts
              </p>
              {results.posts.map((post: any) => (
                <div key={post.id} className="px-4 py-3 border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                  <Link to={`/${post.author_handle}`} className="flex items-center gap-2 mb-1.5">
                    <img src={post.author_avatar || `https://ui-avatars.com/api/?name=${post.author_handle}&background=1d9bf0&color=fff&size=24`}
                      className="w-6 h-6 rounded-full" alt={post.author_handle} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">@{post.author_handle}</span>
                  </Link>
                  <p className="text-sm text-gray-900 dark:text-white leading-relaxed line-clamp-3">{post.content}</p>
                  <p className="text-xs text-gray-400 mt-1">{post.likes_count} likes · {post.reposts_count} reposts</p>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {!results.posts?.length && !results.users?.length && !results.hashtags?.length && (
            <div className="text-center py-16 text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-30" />
              <p>No results for "{debouncedQ}"</p>
            </div>
          )}
        </div>
      )}

      {/* Default: trending feed */}
      {!isSearch && <Feed type="explore" />}
    </div>
  );
}
