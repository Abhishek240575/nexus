import { useState, useRef }  from 'react';
import { Image, Smile, BarChart2, Calendar, X } from 'lucide-react';
import { useAuthStore }       from '@/stores/auth.store';
import { postsService }       from '@/services/posts.service';
import { useQueryClient }     from '@tanstack/react-query';

interface PostComposerProps {
  replyToId?:  string;
  onPosted?:   () => void;
  placeholder?: string;
  autoFocus?:  boolean;
}

export default function PostComposer({
  replyToId, onPosted, placeholder = "What's happening?", autoFocus
}: PostComposerProps) {
  const { user }        = useAuthStore();
  const queryClient     = useQueryClient();
  const [content, setContent]     = useState('');
  const [submitting, setSubmitting] = useState('');
  const [error, setError]         = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX    = 280;
  const remain = MAX - content.length;
  const pct    = Math.min((content.length / MAX) * 100, 100);
  const canPost = content.trim().length > 0 && remain >= 0 && !submitting;

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  const handleSubmit = async () => {
    if (!canPost) return;
    setSubmitting('Posting…');
    setError('');
    try {
      await postsService.createPost({
        content:      content.trim(),
        reply_to_id:  replyToId,
      });
      setContent('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['replies', replyToId] });
      onPosted?.();
      // Re-check feed after AI moderation runs (~3 seconds)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['replies', replyToId] });
      }, 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to post');
    } finally {
      setSubmitting('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  if (!user) return null;

  const avatarUrl = user.avatar_url ||
    `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=40`;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex gap-3">
        <img src={avatarUrl} alt={user.handle}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={replyToId ? 2 : 3}
            className="w-full resize-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base leading-relaxed min-h-[56px]"
          />

          {error && (
            <p className="text-red-500 text-sm mb-2">{error}</p>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 -ml-1">
              {[Image, Smile, BarChart2, Calendar].map((Icon, i) => (
                <button key={i}
                  className="p-2 text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
                  <Icon size={18} />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Character counter */}
              {content.length > 0 && (
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none"
                      stroke="currentColor" strokeWidth="2"
                      className="text-gray-200 dark:text-gray-700" />
                    <circle cx="10" cy="10" r="8" fill="none"
                      stroke={remain < 20 ? (remain < 0 ? '#ef4444' : '#f59e0b') : '#1d9bf0'}
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 8}`}
                      strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct / 100)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 10 10)" />
                  </svg>
                  {remain <= 20 && (
                    <span className={`text-sm ${remain < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {remain}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canPost}
                className="bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded-full text-sm transition-colors"
              >
                {submitting || (replyToId ? 'Reply' : 'Post')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
