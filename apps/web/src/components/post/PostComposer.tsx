import { useState, useRef, useCallback } from 'react';
import { Image, Smile, BarChart2, Calendar, X, Plus, Trash2 } from 'lucide-react';
import { useAuthStore }    from '@/stores/auth.store';
import { postsService }    from '@/services/posts.service';
import { useQueryClient }  from '@tanstack/react-query';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { api } from '@/services/api.client';

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

  // Schedule
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Language selection for posting
  const [postLang,      setPostLang]      = useState('auto');
  const [showLangMenu,  setShowLangMenu]  = useState(false);

  // Exclusive post toggle (Pro/Enterprise only)
  const [isExclusive, setIsExclusive] = useState(false);
  const isPro = ['pro', 'enterprise'].includes(user?.premium_tier || '');

  const POST_LANGUAGES = [
    { code: 'auto', label: 'Auto-detect' },
    { code: 'en',   label: 'English' },
    { code: 'hi',   label: 'हिंदी' },
    { code: 'ta',   label: 'தமிழ்' },
    { code: 'te',   label: 'తెలుగు' },
    { code: 'bn',   label: 'বাংলা' },
    { code: 'mr',   label: 'मराठी' },
    { code: 'gu',   label: 'ગુજરાતી' },
    { code: 'kn',   label: 'ಕನ್ನಡ' },
    { code: 'ml',   label: 'മലയാളം' },
    { code: 'pa',   label: 'ਪੰਜਾਬੀ' },
    { code: 'ur',   label: 'اردو' },
    { code: 'or',   label: 'ଓଡ଼ିଆ' },
    { code: 'ar',   label: 'العربية' },
    { code: 'zh',   label: '中文' },
    { code: 'ru',   label: 'Русский' },
    { code: 'fa',   label: 'فارسی' },
    { code: 'es',   label: 'Español' },
    { code: 'fr',   label: 'Français' },
    { code: 'de',   label: 'Deutsch' },
    { code: 'pt',   label: 'Português' },
    { code: 'nl',   label: 'Nederlands' },
  ];

  const selectedLangLabel = POST_LANGUAGES.find(l => l.code === postLang)?.label || 'Auto-detect';

  const TIER_LIMITS: Record<string, number> = { free: 280, plus: 1000, pro: 1000, enterprise: 1000 };
  const MAX    = TIER_LIMITS[user?.premium_tier || 'free'] || 280;
  const remain = MAX - content.length;
  const pct    = Math.min((content.length / MAX) * 100, 100);
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0 || showPoll) && remain >= 0 && !submitting;

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  // ─── Image handling ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - mediaFiles.length);
    if (!files.length) return;
    const newFiles    = [...mediaFiles, ...files].slice(0, 4);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setMediaFiles(newFiles);
    setMediaPreviews(newPreviews);
  };

  const removeMedia = (i: number) => {
    setMediaFiles(f => f.filter((_, idx) => idx !== i));
    setMediaPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!mediaFiles.length) return [];
    // Convert to base64 data URLs for now (no dedicated upload endpoint needed)
    return mediaPreviews;
  };

  // ─── Emoji handling ──────────────────────────────────────────────────────────
  const onEmojiClick = (emojiData: EmojiClickData) => {
    const el  = textareaRef.current;
    const pos = el?.selectionStart ?? content.length;
    setContent(c => c.slice(0, pos) + emojiData.emoji + c.slice(pos));
    setShowEmoji(false);
    setTimeout(() => {
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = pos + emojiData.emoji.length; }
    }, 0);
  };

  // ─── Poll handling ───────────────────────────────────────────────────────────
  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions(o => [...o, { text: '' }]);
  };

  const removePollOption = (i: number) => {
    if (pollOptions.length > 2) setPollOptions(o => o.filter((_, idx) => idx !== i));
  };

  const updatePollOption = (i: number, text: string) => {
    setPollOptions(o => o.map((opt, idx) => idx === i ? { text } : opt));
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canPost) return;
    setSubmitting('Posting…');
    setError('');
    try {
      const media_urls = await uploadImages();

      let scheduled_at: string | undefined;
      if (showSchedule && scheduleDate && scheduleTime) {
        scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }

      await postsService.createPost({
        content:      content.trim() || null,
        reply_to_id:  replyToId,
        media_urls,
        scheduled_at,
        language:     postLang === 'auto' ? undefined : postLang,
        is_exclusive: isExclusive || undefined,
      });

      // If poll, create it separately
      if (showPoll && pollOptions.some(o => o.text.trim())) {
        // Poll creation would go here via a separate API call
        // For now the post is created and poll data is embedded in content
      }

      setContent('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setShowEmoji(false);
      setShowPoll(false);
      setShowSchedule(false);
      setPollOptions([{ text: '' }, { text: '' }]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['replies', replyToId] });
      onPosted?.();
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
    if (e.key === 'Escape') setShowEmoji(false);
  };

  if (!user) return null;

  const avatarUrl = user.avatar_url ||
    `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=40`;

  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex gap-3">
        <img src={avatarUrl} alt={user.handle}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            lang={postLang === 'auto' ? undefined : postLang}
            dir={['ar', 'ur', 'fa'].includes(postLang) ? 'rtl' : 'ltr'}
            onChange={e => { setContent(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={replyToId ? 2 : 3}
            className="w-full resize-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base leading-relaxed min-h-[56px]"
          />

          {/* Media previews */}
          {mediaPreviews.length > 0 && (
            <div className={`grid gap-1.5 mb-3 rounded-2xl overflow-hidden ${mediaPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {mediaPreviews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-full object-cover max-h-48 rounded-xl" />
                  <button onClick={() => removeMedia(i)}
                    className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Poll builder */}
          {showPoll && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Poll</p>
                <button onClick={() => setShowPoll(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={opt.text} onChange={e => updatePollOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`} maxLength={25}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                  {pollOptions.length > 2 && (
                    <button onClick={() => removePollOption(i)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button onClick={addPollOption}
                  className="flex items-center gap-1 text-brand text-sm hover:underline">
                  <Plus size={14} /> Add option
                </button>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">Duration:</span>
                <select value={pollHours} onChange={e => setPollHours(Number(e.target.value))}
                  className="text-xs border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
                  <option value={24}>1 day</option>
                  <option value={48}>2 days</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
          )}

          {/* Schedule picker */}
          {showSchedule && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Schedule post</p>
                <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
              </div>
              {scheduleDate && scheduleTime && (
                <p className="text-xs text-brand mt-1.5">
                  Will post on {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="absolute z-50 mt-1">
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                width={300}
                height={350}
                searchDisabled={false}
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

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
              <button onClick={() => setShowSchedule(s => !s)}
                title="Schedule post"
                className={`p-2 rounded-full transition-colors ${showSchedule ? 'bg-blue-50 dark:bg-blue-900/20 text-brand' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                <Calendar size={18} />
              </button>

              {/* Exclusive toggle — Pro/Enterprise only */}
              {isPro && !replyToId && (
                <button
                  onClick={() => setIsExclusive(e => !e)}
                  title="Make this post exclusive to your subscribers"
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1 ${
                    isExclusive
                      ? 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400 hover:text-amber-500'
                  }`}>
                  👑 {isExclusive ? 'Exclusive' : 'Public'}
                </button>
              )}
                <button onClick={() => setShowLangMenu(s => !s)}
                  title="Post language"
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors border ${showLangMenu ? 'border-brand text-brand bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand hover:text-brand'}`}>
                  <span className="hidden sm:inline">{postLang === 'auto' ? '🌐 Auto' : selectedLangLabel}</span>
                  <span className="sm:hidden">🌐</span>
                </button>
                {showLangMenu && (
                  <div className="absolute top-8 left-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-44 py-1 max-h-64 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-400 px-3 pt-2 pb-1 sticky top-0 bg-white dark:bg-gray-900">Posting language</p>
                    {POST_LANGUAGES.map(l => (
                      <button key={l.code} onClick={() => { setPostLang(l.code); setShowLangMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${postLang === l.code ? 'text-brand bg-brand/5 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                {submitting ? 'Posting…' : showSchedule && scheduleDate && scheduleTime ? 'Schedule' : replyToId ? 'Reply' : 'Post'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
