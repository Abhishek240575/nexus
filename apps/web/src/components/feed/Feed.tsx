import { postsService, usersService } from '@/services/posts.service';
import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery }   from '@tanstack/react-query';
import PostCard               from '@/components/post/PostCard';
import { Loader2 }            from 'lucide-react';

interface FeedProps {
  type: 'home' | 'explore' | 'hashtag' | 'profile';
  hashtag?:  string;
  handle?:   string;
  tab?:      string;
}

export default function Feed({ type, hashtag, handle, tab }: FeedProps) {
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchFn = ({ pageParam }: { pageParam: string | undefined }) => {
    if (type === 'home')    return postsService.getHomeFeed(pageParam);
    if (type === 'explore') return postsService.getExploreFeed(pageParam);
    if (type === 'hashtag') return postsService.getPostsByHashtag(hashtag!, pageParam);
    if (type === 'profile') return usersService.getUserPosts(handle!, tab, pageParam);
    return postsService.getHomeFeed(pageParam);
  };

  const queryKey = type === 'hashtag'
    ? ['hashtag', hashtag]
    : type === 'profile'
    ? ['profile-posts', handle, tab]
    : ['feed', type];

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError,
  } = useInfiniteQuery({
    queryKey,
    queryFn:            fetchFn,
    initialPageParam:   undefined as string | undefined,
    getNextPageParam:   (last: any) => last.data?.data?.next_cursor ?? undefined,
    staleTime:          1000 * 30,
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (data) {
      const all = data.pages.flatMap((p: any) => p.data?.data?.data ?? p.data?.data ?? []);
      setPosts(all);
    }
  }, [data]);

  const handleDelete = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 size={24} className="animate-spin text-brand" />
    </div>
  );

  if (isError) return (
    <div className="text-center py-12 text-gray-500">
      Failed to load posts. Please try again.
    </div>
  );

  if (posts.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-lg font-medium mb-1">Nothing here yet</p>
      <p className="text-sm">
        {type === 'home' ? 'Follow some people to see their posts here.' : 'No posts found.'}
      </p>
    </div>
  );

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} onDelete={handleDelete} />
      ))}

      <div ref={loaderRef} className="flex justify-center py-6">
        {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-brand" />}
        {!hasNextPage && posts.length > 0 && (
          <p className="text-sm text-gray-400">You're all caught up</p>
        )}
      </div>
    </div>
  );
}
