import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { postsService } from '@/services/posts.service';
import { Link } from 'react-router-dom';

export default function RightPanel() {
  const { data: trendingData } = useQuery({
    queryKey: ['trending'],
    queryFn:  () => postsService.getTrending(),
    staleTime: 1000 * 60 * 3,
  });

  const trending = trendingData?.data?.data ?? [];

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2">
        <Search size={16} className="text-gray-500" />
        <input
          placeholder="Search Deemona"
          className="bg-transparent flex-1 text-sm outline-none text-gray-900 dark:text-white placeholder-gray-500"
        />
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
        <h2 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Trending now</h2>
        {trending.length > 0
          ? trending.map((tag: any) => (
            <Link key={tag.id} to={`/hashtag/${tag.name}`}
              className="block py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 -mx-4 px-4 transition-colors">
              <p className="text-xs text-gray-500">Trending</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">#{tag.name}</p>
              <p className="text-xs text-gray-400">{tag.recent_posts} posts</p>
            </Link>
          ))
          : ['#buildinpublic','#IndiaStartups','#postgres','#openSource'].map(tag => (
            <div key={tag} className="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 -mx-4 px-4">
              <p className="text-xs text-gray-500">Trending</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{tag}</p>
            </div>
          ))
        }
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
        <h2 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Who to follow</h2>
        {[
          { handle: 'priya_v', name: 'Priya V' },
          { handle: 'rohan_s', name: 'Rohan S' },
          { handle: 'meera_k', name: 'Meera K' },
        ].map(u => (
          <div key={u.handle} className="flex items-center gap-3 py-2">
            <img
              src={`https://ui-avatars.com/api/?name=${u.name}&background=1d9bf0&color=fff&size=36`}
              className="w-9 h-9 rounded-full" alt={u.name}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
              <p className="text-xs text-gray-500">@{u.handle}</p>
            </div>
            <button className="text-sm font-semibold border border-gray-900 dark:border-white text-gray-900 dark:text-white px-4 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
