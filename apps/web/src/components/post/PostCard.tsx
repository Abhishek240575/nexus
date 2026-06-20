import { useState, useRef, useEffect } from 'react';
import { Link }            from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, Bookmark, Share, MoreHorizontal, Globe, X,
         UserPlus, VolumeX, Ban, Flag, Code, ThumbsDown, BarChart2, Eye, Crown } from 'lucide-react';
import { postsService }    from '@/services/posts.service';
import VerifiedBadge       from '@/components/common/VerifiedBadge';
import TipButton           from '@/components/post/TipButton';
import { useAuthStore }    from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';
import clsx from 'clsx';
import { api } from '@/services/api.client';

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
  author_is_journalist?: boolean;
  is_exclusive?:  boolean;
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
  const [translated,   setTranslated]   = useState<string | null>(null);
  const [translating,  setTranslating]  = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuMsg, setMenuMsg]   = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [activity,     setActivity]     = useState<any>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const LANGS = [
    // Indian languages
    { code: 'hi', label: 'हिंदी',       group: 'Indian' },
    { code: 'ta', label: 'தமிழ்',      group: 'Indian' },
    { code: 'te', label: 'తెలుగు',     group: 'Indian' },
    { code: 'bn', label: 'বাংলা',      group: 'Indian' },
    { code: 'mr', label: 'मराठी',      group: 'Indian' },
    { code: 'gu', label: 'ગુજરાતી',    group: 'Indian' },
    { code: 'kn', label: 'ಕನ್ನಡ',      group: 'Indian' },
    { code: 'ml', label: 'മലയാളം',     group: 'Indian' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ',     group: 'Indian' },
    { code: 'ur', label: 'اردو',       group: 'Indian' },
    { code: 'or', label: 'ଓଡ଼ିଆ',      group: 'Indian' },
    // Global languages
    { code: 'en', label: 'English',    group: 'Global' },
    { code: 'ar', label: 'العربية',    group: 'Global' },
    { code: 'zh', label: '中文',        group: 'Global' },
    { code: 'ru', label: 'Русский',    group: 'Global' },
    { code: 'fa', label: 'فارسی',      group: 'Global' },
    { code: 'es', label: 'Español',    group: 'Global' },
    { code: 'fr', label: 'Français',   group: 'Global' },
    { code: 'de', label: 'Deutsch',    group: 'Global' },
    { code: 'pt', label: 'Português',  group: 'Global' },
    { code: 'nl', label: 'Nederlands', group: 'Global' },
  ];

  const handleTranslate = async (langCode: string) => {
    setShowLangPicker(false);
    if (translating) return;
    setTranslating(true);
    try {
      const res = await api.get(`/api/translate/post/${post.id}`, { params: { target: langCode } });
      setTranslated(res.data?.data?.translated || null);
    } catch {
      setTranslated('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

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
    setShowMenu(false);
  };

  const handleMenuAction = async (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    setShowMenu(false);
    switch (action) {
      case 'not_interested':
        setMenuMsg("Got it — we'll show fewer posts like this");
        setTimeout(() => setMenuMsg(''), 3000);
        break;
      case 'follow':
        try {
          await api.post(`/api/users/${post.author_handle}/follow`);
          setMenuMsg(`Following @${post.author_handle}`);
        } catch { setMenuMsg('Failed to follow'); }
        setTimeout(() => setMenuMsg(''), 3000);
        break;
      case 'mute':
        setMenuMsg(`@${post.author_handle} muted`);
        setTimeout(() => setMenuMsg(''), 3000);
        break;
      case 'block':
        if (confirm(`Block @${post.author_handle}?`)) {
          try {
            await api.post(`/api/users/${post.author_handle}/block`);
            setMenuMsg(`@${post.author_handle} blocked`);
          } catch { setMenuMsg('Failed to block'); }
          setTimeout(() => setMenuMsg(''), 3000);
        }
        break;
      case 'report':
        setMenuMsg('Report submitted — thank you');
        setTimeout(() => setMenuMsg(''), 3000);
        break;
      case 'embed': {
        const embedCode = `<blockquote class="nexus-post"><a href="${window.location.origin}/${post.author_handle}/post/${post.id}">@${post.author_handle}: ${post.content?.slice(0, 100)}</a></blockquote>`;
        await navigator.clipboard.writeText(embedCode);
        setMenuMsg('Embed code copied!');
        setTimeout(() => setMenuMsg(''), 3000);
        break;
      }
      case 'activity': {
        try {
          const res = await api.get(`/api/lists/activity/${post.id}`);
          setActivity(res.data?.data);
          setShowActivity(true);
        } catch { setMenuMsg('Could not load activity'); setTimeout(() => setMenuMsg(''), 2000); }
        break;
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `${window.location.origin}/${post.author_handle}/post/${post.id}`;
    if (navigator.share) {
      await navigator.share({ title: `Post by @${post.author_handle}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
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
                <VerifiedBadge tier={post.author_tier} size={14} />
              )}
              {post.author_is_journalist && (
                <span title="Verified journalist" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Press</span>
              )}
              <span className="text-gray-500 text-sm truncate">@{post.author_handle}</span>
              <span className="text-gray-400 text-sm flex-shrink-0">·</span>
              <span className="text-gray-500 text-sm flex-shrink-0">
                {formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: false })}
              </span>
            </div>
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button onClick={e => { e.preventDefault(); setShowMenu(s => !s); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-56 py-1 overflow-hidden">
                  <MenuItem icon={ThumbsDown} label="Not interested" onClick={e => handleMenuAction(e, 'not_interested')} />
                  {user?.handle !== post.author_handle && (
                    <MenuItem icon={UserPlus} label={`Follow @${post.author_handle}`} onClick={e => handleMenuAction(e, 'follow')} />
                  )}
                  {user?.handle !== post.author_handle && (
                    <MenuItem icon={VolumeX} label={`Mute @${post.author_handle}`} onClick={e => handleMenuAction(e, 'mute')} />
                  )}
                  {user?.handle !== post.author_handle && (
                    <MenuItem icon={Ban} label={`Block @${post.author_handle}`} onClick={e => handleMenuAction(e, 'block')} danger />
                  )}
                  <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                  <MenuItem icon={Flag} label="Report post" onClick={e => handleMenuAction(e, 'report')} danger />
                  <MenuItem icon={Code} label="Embed post" onClick={e => handleMenuAction(e, 'embed')} />
                  <MenuItem icon={BarChart2} label="View post activity" onClick={e => handleMenuAction(e, 'activity')} />
                  {user?.handle === post.author_handle && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                      <MenuItem icon={X} label="Delete post" onClick={handleDelete} danger />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Post text */}
          {post.is_exclusive && !post.content ? (
            <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 mb-2 text-center">
              <Crown size={20} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Exclusive content</p>
              <p className="text-xs text-gray-500 mb-3">Subscribe to {post.author_name || post.author_handle} to read this post</p>
              <a href={`/${post.author_handle}`}
                className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-600 transition-colors">
                <Crown size={12} /> View subscription
              </a>
            </div>
          ) : post.content && (
            <p className="text-sm text-gray-900 dark:text-white leading-relaxed mb-2">
              {post.is_exclusive && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded mr-1.5 mb-1">
                  <Crown size={10} /> Exclusive
                </span>
              )}
              {renderContent(post.content)}
            </p>
          )}

          {/* Translation */}
          {translated && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                  <Globe size={10} /> Translated
                </span>
                <button onClick={e => { e.preventDefault(); setTranslated(null); }} className="text-blue-400 hover:text-blue-600">
                  <X size={12} />
                </button>
              </div>
              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">{translated}</p>
            </div>
          )}

          {/* Language picker */}
          {showLangPicker && (
            <div className="mb-2 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Indian */}
              <div className="px-3 pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Indian Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGS.filter(l => l.group === 'Indian').map(l => (
                    <button key={l.code} onClick={e => { e.preventDefault(); handleTranslate(l.code); }}
                      className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-brand hover:text-white text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full transition-colors">
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 px-3 pt-2 pb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Global Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGS.filter(l => l.group === 'Global').map(l => (
                    <button key={l.code} onClick={e => { e.preventDefault(); handleTranslate(l.code); }}
                      className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-brand hover:text-white text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full transition-colors">
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action feedback toast */}
          {menuMsg && (
            <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs px-3 py-1.5 rounded-full mb-2 inline-block">
              {menuMsg}
            </div>
          )}

          {/* Post activity modal */}
          {showActivity && activity && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-2 bg-gray-50 dark:bg-gray-900/50"
              onClick={e => e.preventDefault()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-brand" /> Post Activity
                </p>
                <button onClick={e => { e.preventDefault(); setShowActivity(false); }} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Eye,            label: 'Views',     value: activity.views },
                  { icon: Heart,          label: 'Likes',     value: activity.likes },
                  { icon: Repeat2,        label: 'Reposts',   value: activity.reposts },
                  { icon: MessageCircle,  label: 'Replies',   value: activity.replies },
                  { icon: Bookmark,       label: 'Bookmarks', value: activity.bookmarks },
                  { icon: BarChart2,      label: 'Engage %',  value: `${activity.engagement_rate}%` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="text-center">
                    <Icon size={14} className="text-brand mx-auto mb-1" />
                    <p className="text-base font-bold text-gray-900 dark:text-white">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
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
              title="Reply" onClick={e => e.preventDefault()} />
            <ActionBtn icon={Repeat2} count={repostsCount} active={reposted}
              activeColor="text-green-500" title="Repost" onClick={handleRepost} />
            <ActionBtn icon={Heart} count={likesCount} active={liked}
              activeColor="text-pink-500" title="Like" onClick={handleLike} />
            <ActionBtn icon={Bookmark} count={0} active={bookmarked}
              activeColor="text-brand" title="Bookmark" onClick={handleBookmark} showCount={false} />
            <button
              onClick={e => { e.preventDefault(); setShowLangPicker(s => !s); setTranslated(null); }}
              title="Translate"
              className={`p-2 rounded-full transition-colors ${showLangPicker ? 'text-brand bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500 hover:text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
              {translating ? <span className="text-xs">…</span> : <Globe size={16} />}
            </button>
            <button
              onClick={handleShare}
              title="Share"
              className="p-2 rounded-full text-gray-500 hover:text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Share size={16} />
            </button>
            <TipButton toHandle={post.author_handle} postId={post.id} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActionBtn({ icon: Icon, count, active, activeColor, onClick, showCount = true, title }: {
  icon: any; count: number; active?: boolean; activeColor?: string; title?: string;
  onClick: (e: React.MouseEvent) => void; showCount?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
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

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
        danger ? 'text-red-500 hover:text-red-600' : 'text-gray-900 dark:text-white'
      }`}>
      <Icon size={15} />
      {label}
    </button>
  );
}
