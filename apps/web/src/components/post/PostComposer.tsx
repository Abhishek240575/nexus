import { useState, useRef, useCallback } from 'react';
import { Image, Smile, BarChart2, Calendar, X, Plus, Trash2 } from 'lucide-react';
import { useAuthStore }    from '@/stores/auth.store';
import { postsService }    from '@/services/posts.service';
import { useQueryClient }  from '@tanstack/react-query';
import EmojiPicker         from 'emoji-picker-react';
import { api }             from '@/services/api.client';

interface PostComposerProps {
  replyToId?:  string;
  onPosted?:   () => void;
  placeholder?: string;
  autoFocus?:  boolean;
}

interface PollOption { text: string; }

export default function PostComposer({
  replyToId, onPosted, placeholder = "What's happening?", autoFocus
}: PostComposerProps) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [content,    setContent]    = useState('');
  const [submitting, setSubmitting] = useState('');
  const [error,      setError]      = useState('');
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  // Media
  const [mediaFiles,   setMediaFiles]   = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [uploading,    setUploading]    = useState(false);

  // Emoji
  const [showEmoji, setShowEmoji] = useState(false);

  // Poll
  const [showPoll,   setShowPoll]   = useState(false);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ text: '' }, { text: '' }]);
  const [pollHours,  setPollHours]  = useState(24);

  // Submit handler
  const handleSubmit = async () => {
    if (submitting) return;
    if (!content.trim() && mediaFiles.length === 0 && !showPoll) return;

    setSubmitting('Posting...');
    setError('');

    try {
      let media_urls: string[] = [];

      if (mediaFiles.length > 0) {
        setUploading(true);
        const uploads = await Promise.all(
          mediaFiles.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/api/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            return res.data.data.url as string;
          })
        );
        media_urls = uploads;
        setUploading(false);
      }

      const poll = showPoll
        ? { options: pollOptions.map(o => o.text).filter(Boolean), duration_hours: pollHours }
        : undefined;

      await postsService.createPost({
        content:      content.trim() || null,
        reply_to_id:  replyToId,
        media_urls,
      });

      setContent('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setShowPoll(false);
      setShowEmoji(false);
      setPollOptions([{ text: '' }, { text: '' }]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onPosted?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not post. Please try again.');
    } finally {
      setSubmitting('');
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - mediaFiles.length);
    const newFiles    = [...mediaFiles,    ...files].slice(0, 4);
    const newPreviews = [...mediaPreviews, ...files.map(f => URL.createObjectURL(f))].slice(0, 4);
    setMediaFiles(newFiles);
    setMediaPreviews(newPreviews);
    e.target.value = '';
  };

  const removeMedia = (idx: number) => {
    setMediaFiles(prev    => prev.filter((_, i) => i !== idx));
    setMediaPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const TIER_LIMITS: Record<string, number> = { free: 280, plus: 1000, pro: 1000, enterprise: 1000 };
  const MAX    = TIER_LIMITS[user?.premium_tier || 'free'] || 280;
  const remain = MAX - content.length;
  const pct    = Math.min((content.length / MAX) * 100, 100);
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0 || showPoll) && remain >= 0 && !submitting;

  if (!user) return null;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex gap-3">
        <img
          src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=40`}
          alt={user.handle}
          className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
        />

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

          {/* Error */}
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          {/* Media previews */}
          {mediaPreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {mediaPreviews.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeMedia(i)}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Poll builder */}
          {showPoll && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-3 mb-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Poll</p>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={opt.text} placeholder={`Option ${i + 1}`}
                    onChange={e => { const o = [...pollOptions]; o[i].text = e.target.value; setPollOptions(o); }}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                  {i > 1 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button onClick={() => setPollOptions(prev => [...prev, { text: '' }])}
                  className="flex items-center gap-1 text-brand text-sm hover:underline">
                  <Plus size={14} /> Add option
                </button>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">Duration:</span>
                {[24, 48, 72, 168].map(h => (
                  <button key={h} onClick={() => setPollHours(h)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${pollHours === h ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {h < 48 ? `${h}h` : `${h / 24}d`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="mb-3">
              <EmojiPicker
                onEmojiClick={e => {
                  const ta = textareaRef.current;
                  if (!ta) { setContent(prev => prev + e.emoji); return; }
                  const start = ta.selectionStart;
                  const end   = ta.selectionEnd;
                  setContent(prev => prev.slice(0, start) + e.emoji + prev.slice(end));
                  setTimeout(() => {
                    ta.selectionStart = ta.selectionEnd = start + e.emoji.length;
                    ta.focus();
                  }, 0);
                }}
                width="100%"
                height={300}
              />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 -ml-1 flex-wrap">

              {/* Image upload */}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 4 || showPoll}
                title="Add image"
                className="p-2 text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Image size={18} />
              </button>

              {/* Emoji picker */}
              <div className="relative">
                <button onClick={() => setShowEmoji(s => !s)}
                  title="Add emoji"
                  className={`p-2 rounded-full transition-colors ${showEmoji ? 'bg-blue-50 dark:bg-blue-900/20 text-brand' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                  <Smile size={18} />
                </button>
              </div>

              {/* Poll */}
              <button onClick={() => { setShowPoll(s => !s); setMediaFiles([]); setMediaPreviews([]); }}
                disabled={mediaFiles.length > 0}
                title="Create poll"
                className={`p-2 rounded-full transition-colors ${showPoll ? 'bg-blue-50 dark:bg-blue-900/20 text-brand' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'} disabled:opacity-40`}>
                <BarChart2 size={18} />
              </button>

              {/* Schedule */}
              <button
                title="Schedule post (coming soon)"
                className="p-2 rounded-full transition-colors text-gray-300 dark:text-gray-600 cursor-not-allowed">
                <Calendar size={18} />
              </button>

            </div>

            <div className="flex items-center gap-3">
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
                className="bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded-full text-sm transition-colors">
                {submitting ? submitting : replyToId ? 'Reply' : 'Post'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
