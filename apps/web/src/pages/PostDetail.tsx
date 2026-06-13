import { useParams, Link }   from 'react-router-dom';
import { useQuery }          from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { postsService }      from '@/services/posts.service';
import PostCard              from '@/components/post/PostCard';
import PostComposer          from '@/components/post/PostComposer';

export default function PostDetail() {
  const { id } = useParams<{ handle: string; id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn:  () => postsService.getPost(id!),
    enabled:  !!id,
  });

  const { data: repliesData, isLoading: repliesLoading, refetch } = useQuery({
    queryKey: ['replies', id],
    queryFn:  () => postsService.getReplies(id!),
    enabled:  !!id,
  });

  const post    = data?.data?.data;
  const replies = repliesData?.data?.data?.data ?? [];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;
  if (!post)     return <div className="text-center py-12 text-gray-400">Post not found</div>;

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3 flex items-center gap-4">
        <Link to={-1 as any} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Post</h1>
      </div>

      <PostCard post={post} showThread={replies.length > 0} />

      <PostComposer
        replyToId={id}
        placeholder="Post your reply"
        onPosted={() => refetch()}
      />

      {repliesLoading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand" /></div>}

      {replies.map((reply: any) => (
        <PostCard key={reply.id} post={reply} />
      ))}
    </div>
  );
}
