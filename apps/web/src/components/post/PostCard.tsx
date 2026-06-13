import { useState }        from 'react';
import { Link }            from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, Bookmark, Share, MoreHorizontal } from 'lucide-react';
import { postsService }    from '@/services/posts.service';
import { useAuthStore }    from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';
import clsx from 'clsx';

interface Post {
  id:             string;
  content:        string | null;
  media_urls:     string[];
  reply_to_id:    string | null;
  quote_of_id:    string | null;
  likes_count:    number;
  reposts_count:  number;
  replies_count:  number;
  views_count:    number;
  created_at:     string;
  author_handle:  string;
  author_name:    string | null;
  author_avatar:  string | null;
  author_verified:boolean;
  author_tier:    string;
  is_liked?:      boolean;
  is_reposted?:   boolean;
  is_bookmarked?: boolean;
}

interface PostCardProps {
  post:        Post;
  onDelete?:   (id: string) => void;
  showThread?: boolean;
}

export default function PostCard({ post, onDelete, showThread }: PostCardProps) {
  const { user }       = useAuthStore();
  const [liked,        setLiked]        = useState(post.is_liked       ?? false);
  const [reposted,     setReposted]     = useState(post.is_reposted    ?? false);
  const [bookmarked,   setBookmarked]   = useState(post.is_bookmarked  ?? false);
  const [likesCount,   setLikesCount]   = useState(post.likes_count);
  const [repostsCount, setRepostsCount] = useState(post.reposts_count);

  const avatarUrl = post.author_avatar ||
    `https://ui-avatars.com/api/?name=${post.author_handle}&background=1d9bf0&color=fff&size=40`;

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const prev = liked;
    setLiked(!liked);
    setLikesCount(c => liked ? c - 1 : c + 1);
    try {
      await postsService.likePost(post.id);
    } catch {
      setLiked(prev);
      setLikesCount(c => liked ? c + 1 : c - 1);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const prev = reposted;
    setReposted(!reposted);
    setRepostsCount(c => reposted ? c - 1 : c + 1);
    try {
      await postsService.repostPost(post.id);
    } catch {
      setReposted(prev);
      setRepostsCount(c => reposted ? c + 1 : c - 1);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    setBookmarked(b => !b);
    try {
      await postsService.bookmarkPost(post.id);
    } catch {
      setBookmarked(b => !b);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Delete this post?')) return;
    try {
      await postsService.deletePost(post.id);
      onDelete?.(post.id);
    } catch {}
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Link key={i} to={`/hashtag/${part.slice(1)}`}
            className="text-brand hover:underline" onClick={e => e.stopPropagation()}>
            {part}
          </Link>
        );
      }
      if (part.startsWith('@')) {
        return (
          <Link key={i} to={`/${part.slice(1)}`}
            className="text-brand hover:underline" onClick={e => e.stopPropagation()}>
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <Link to={`/${post.author_handle}/post/${post.id}`}
      className="block border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
      <div className="flex gap-3 px-4 py-3">
        {/* Avatar + thread line */}
        <div className="flex flex-col items-center">
          <Link to={`/${post.author_handle}`} onClick={e => e.stopPropagation()}>
            <img src={avatarUrl} alt={post.author_handle}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          </Link>
          {showThread && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link to={`/${post.author_handle}`}
                className="font-semibold text-sm text-gray-900 dark:text-white hover:underline truncate"
                onClick={e => e.stopPropagation()}>
                {post.author_name || post.author_handle}
              </Link>
              {post.author_verified && (
                <span className="text-brand text-xs">✓</span>
              )}
              <span className="text-gray-500 text-sm truncate">@{post.author_handle}</span>
              <span className="text-gray-400 text-sm flex-shrink-0">·</span>
              <span className="text-gray-500 text-sm flex-shrink-0">
                {formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: false })}
              </span>
            </div>
            {user?.handle === post.author_handle && (
              <button onClick={handleDelete}
                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0">
                <MoreHorizontal size={16} />
              </button>
            )}
          </div>

          {/* Post text */}
          {post.content && (
            <p className="text-sm text-gray-900 dark:text-white leading-relaxed mb-2">
              {renderContent(post.content)}
            </p>
          )}

          {/* Media */}
          {post.media_urls?.length > 0 && (
            <div className={clsx('grid gap-1 mb-2 rounded-xl overflow-hidden',
              post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {post.media_urls.slice(0, 4).map((url, i) => (
                <img key={i} src={url} alt="" className="w-full object-cover max-h-64" />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-1 -ml-2 max-w-xs">
            <ActionBtn icon={MessageCircle} count={post.replies_count}
              onClick={e => e.preventDefault()} />
            <ActionBtn icon={Repeat2} count={repostsCount} active={reposted}
              activeColor="text-green-500" onClick={handleRepost} />
            <ActionBtn icon={Heart} count={likesCount} active={liked}
              activeColor="text-pink-500" onClick={handleLike} />
            <ActionBtn icon={Bookmark} count={0} active={bookmarked}
              activeColor="text-brand" onClick={handleBookmark} showCount={false} />
            <button onClick={e => e.preventDefault()}
              className="p-2 rounded-full text-gray-400 hover:text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Share size={16} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActionBtn({ icon: Icon, count, active, activeColor, onClick, showCount = true }: {
  icon: any; count: number; active?: boolean; activeColor?: string;
  onClick: (e: React.MouseEvent) => void; showCount?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 p-2 rounded-full transition-colors text-sm',
        active ? activeColor : 'text-gray-500',
        'hover:bg-gray-100 dark:hover:bg-gray-800'
      )}>
      <Icon size={16} className={active ? activeColor : ''} />
      {showCount && count > 0 && (
        <span className={clsx('text-xs', active ? activeColor : 'text-gray-500')}>
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}
