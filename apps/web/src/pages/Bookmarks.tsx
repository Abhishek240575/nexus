import { useInfiniteQuery } from '@tanstack/react-query';
import { Bookmark, Loader2 } from 'lucide-react';
import PostCard from '@/components/post/PostCard';
import { postsService } from '@/services/posts.service';
import { useState } from 'react';

export default function Bookmarks() {
  const [posts, setPosts] = useState<any[]>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey:         ['bookmarks'],
      queryFn:          ({ pageParam }) => postsService.getBookmarks(pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: any) => last.data?.data?.next_cursor ?? undefined,
    });

  const bookmarks = data?.pages.flatMap((p: any) => p.data?.data?.data ?? []) ?? [];
  const handleDelete = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bookmarks</h1>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {!isLoading && bookmarks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Bookmark size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium mb-1">No bookmarks yet</p>
          <p className="text-sm">Save posts to read later by clicking the bookmark icon.</p>
        </div>
      )}

      {bookmarks.map((post: any) => (
        <PostCard key={post.id} post={post} onDelete={handleDelete} />
      ))}

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
            className="text-brand text-sm hover:underline">
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
