import { useState, useRef } from 'react';
import { Image, Smile, BarChart2, Calendar, X, Plus, Trash2, Video } from 'lucide-react';
import { useAuthStore }   from '@/stores/auth.store';
import { postsService }   from '@/services/posts.service';
import { useQueryClient } from '@tanstack/react-query';
import EmojiPicker        from 'emoji-picker-react';
import { mediaService }   from '@/services/media.service';

interface PostComposerProps {
  replyToId?:   string;
  onPosted?:    () => void;
  placeholder?: string;
  autoFocus?:   boolean;
}
interface PollOption { text: string; }

const POST_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' }, { code: 'en', label: 'English' },
  { code: 'hi',   label: 'Hindi' },       { code: 'ta', label: 'Tamil' },
  { code: 'te',   label: 'Telugu' },      { code: 'bn', label: 'Bengali' },
  { code: 'mr',   label: 'Marathi' },     { code: 'gu', label: 'Gujarati' },
  { code: 'kn',   label: 'Kannada' },     { code: 'ml', label: 'Malayalam' },
  { code: 'pa',   label: 'Punjabi' },     { code: 'ur', label: 'Urdu' },
  { code: 'or',   label: 'Odia' },        { code: 'ar', label: 'Arabic' },
  { code: 'zh',   label: 'Mandarin' },    { code: 'ru', label: 'Russian' },
  { code: 'fa',   label: 'Farsi' },       { code: 'es', label: 'Spanish' },
  { code: 'fr',   label: 'French' },      { code: 'de', label: 'German' },
  { code: 'pt',   label: 'Portuguese' },  { code: 'nl', label: 'Dutch' },
];

export default function PostComposer({ replyToId, onPosted, placeholder = "What's happening?", autoFocus }: PostComposerProps) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [content,    setContent]    = useState('');
  const [submitting, setSubmitting] = useState('');
  const [error,      setError]      = useState('');
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  const [mediaFiles,    setMediaFiles]    = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [videoFile,     setVideoFile]     = useState<File | null>(null);
  const [videoPreview,  setVideoPreview]  = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError,    setVideoError]    = useState('');
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [showPoll,      setShowPoll]      = useState(false);
  const [pollOptions,   setPollOptions]   = useState<PollOption[]>([{ text: '' }, { text: '' }]);
  const [pollHours,     setPollHours]     = useState(24);
  const [postLang,      setPostLang]      = useState('auto');
  const [showLangMenu,  setShowLangMenu]  = useState(false);

  const PAID_TIERS = ['plus', 'pro', 'enterprise'];
  const canUploadVideo = PAID_TIERS.includes(user?.premium_tier || '');
  const selectedLangLabel = POST_LANGUAGES.find(l => l.code === postLang)?.label || 'Auto';

  const handleSubmit = async () => {
    if (submitting) return;
    if (!content.trim() && mediaFiles.length === 0 && !showPoll && !videoFile) return;
    setSubmitting('Posting...'); setError(''); setUploadPct(0);
    try {
      let media_urls: string[] = [];
      if (videoFile) {
        setUploading(true);
        const { public_url } = await mediaService.uploadMedia(videoFile, setUploadPct);
        media_urls = [public_url];
        setUploading(false);
      } else if (mediaFiles.length > 0) {
        setUploading(true);
        media_urls = await Promise.all(mediaFiles.map(async f => {
          const { public_url } = await mediaService.uploadMedia(f);
          return public_url;
        }));
        setUploading(false);
      }
      await postsService.createPost({
        content: content.trim() || null, reply_to_id: replyToId,
        media_urls, language: postLang === 'auto' ? undefined : postLang,
      });
      setContent(''); setMediaFiles([]); setMediaPreviews([]);
      setVideoFile(null); setVideoPreview(null); setVideoDuration(0);
      setShowPoll(false); setShowEmoji(false); setShowLangMenu(false);
      setPollOptions([{ text: '' }, { text: '' }]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onPosted?.();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Could not post.');
    } finally { setSubmitting(''); setUploading(false); setUploadPct(0); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - mediaFiles.length);
    setMediaFiles([...mediaFiles, ...files].slice(0, 4));
    setMediaPreviews([...mediaPreviews, ...files.map(f => URL.createObjectURL(f))].slice(0, 4));
    e.target.value = '';
  };

  const removeMedia = (idx: number) => {
    setMediaFiles(prev    => prev.filter((_, i) => i !== idx));
    setMediaPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError('');
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      setVideoError('Only MP4, MOV, or WebM supported.'); return;
    }
    if (file.size > 50 * 1024 * 1024) { setVideoError('Max 50MB.'); return; }
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (vid.duration > 30) { setVideoError('Video must be 30 seconds or shorter.'); return; }
      setVideoDuration(Math.round(vid.duration));
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setMediaFiles([]); setMediaPreviews([]);
    };
    vid.src = url;
    e.target.value = '';
  };

  const removeVideo = () => { setVideoFile(null); setVideoPreview(null); setVideoDuration(0); setVideoError(''); };

  const TIER_LIMITS: Record<string, number> = { free: 280, plus: 1000, pro: 1000, enterprise: 1000 };
  const MAX    = TIER_LIMITS[user?.premium_tier || 'free'] || 280;
  const remain = MAX - content.length;
  const pct    = Math.min((content.length / MAX) * 100, 100);
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0 || showPoll || !!videoFile) && remain >= 0 && !submitting;

  if (!user) return null;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex gap-3">
        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=40`}
          alt={user.handle} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />

        <div className="flex-1 min-w-0">
          <textarea ref={textareaRef} value={content}
            dir={['ar', 'ur', 'fa'].includes(postLang) ? 'rtl' : 'ltr'}
            onChange={e => { setContent(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown} placeholder={placeholder} autoFocus={autoFocus}
            rows={replyToId ? 2 : 3}
            className="w-full resize-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base leading-relaxed min-h-[56px]" />

          {error      && <p className="text-red-500 text-sm mb-2">{error}</p>}
          {videoError && <p className="text-red-500 text-sm mb-2">{videoError}</p>}

          {/* Video preview */}
          {videoPreview && (
            <div className="relative rounded-2xl overflow-hidden mb-3 bg-black">
              <video src={videoPreview} controls className="w-full max-h-64 rounded-2xl" />
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                {videoDuration}s
              </div>
              <button onClick={removeVideo} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Upload progress */}
          {uploading && uploadPct > 0 && (
            <div className="mb-3">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand transition-all duration-300 rounded-full" style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Uploading... {uploadPct}%</p>
            </div>
          )}

          {/* Image previews */}
          {mediaPreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {mediaPreviews.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeMedia(i)} className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Poll */}
          {showPoll && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-3 mb-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Poll</p>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={opt.text} placeholder={`Option ${i + 1}`}
                    onChange={e => { const o = [...pollOptions]; o[i].text = e.target.value; setPollOptions(o); }}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                  {i > 1 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button onClick={() => setPollOptions(prev => [...prev, { text: '' }])} className="flex items-center gap-1 text-brand text-sm hover:underline">
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

          {/* Emoji */}
          {showEmoji && (
            <div className="mb-3">
              <EmojiPicker onEmojiClick={e => {
                const ta = textareaRef.current;
                if (!ta) { setContent(prev => prev + e.emoji); return; }
                const s = ta.selectionStart, en = ta.selectionEnd;
                setContent(prev => prev.slice(0, s) + e.emoji + prev.slice(en));
                setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + e.emoji.length; ta.focus(); }, 0);
              }} width="100%" height={300} />
            </div>
          )}

          {/* Language dropdown */}
          {showLangMenu && (
            <div className="mb-2 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-lg max-h-52 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 px-3 pt-2 pb-1 sticky top-0 bg-white dark:bg-gray-900">Posting language</p>
              {POST_LANGUAGES.map(l => (
                <button key={l.code} onClick={() => { setPostLang(l.code); setShowLangMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${postLang === l.code ? 'text-brand bg-brand/5 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 -ml-1 flex-wrap">

              {/* Image */}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 4 || showPoll || !!videoFile}
                title="Add image"
                className="p-2 text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Image size={18} />
              </button>

              {/* Video */}
              <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleVideoSelect} />
              {canUploadVideo ? (
                <button onClick={() => videoInputRef.current?.click()}
                  disabled={!!videoFile || mediaFiles.length > 0 || showPoll}
                  title="Add short video (max 30s) — Plus+"
                  className={`p-2 rounded-full transition-colors ${videoFile ? 'text-brand bg-blue-50 dark:bg-blue-900/20' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <Video size={18} />
                </button>
              ) : (
                <button onClick={() => window.location.href = '/premium'}
                  title="Short video requires Plus or higher — tap to upgrade"
                  className="p-2 rounded-full text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-colors">
                  <Video size={18} />
                </button>
              )}

              {/* Emoji */}
              <button onClick={() => setShowEmoji(s => !s)} title="Add emoji"
                className={`p-2 rounded-full transition-colors ${showEmoji ? 'bg-blue-50 dark:bg-blue-900/20 text-brand' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                <Smile size={18} />
              </button>

              {/* Poll */}
              <button onClick={() => { setShowPoll(s => !s); setMediaFiles([]); setMediaPreviews([]); }}
                disabled={mediaFiles.length > 0 || !!videoFile}
                title="Create poll"
                className={`p-2 rounded-full transition-colors ${showPoll ? 'bg-blue-50 dark:bg-blue-900/20 text-brand' : 'text-brand hover:bg-blue-50 dark:hover:bg-blue-900/20'} disabled:opacity-40`}>
                <BarChart2 size={18} />
              </button>

              {/* Schedule */}
              <button title="Schedule (coming soon)" className="p-2 rounded-full text-gray-300 dark:text-gray-600 cursor-not-allowed">
                <Calendar size={18} />
              </button>

              {/* Language */}
              <button onClick={() => setShowLangMenu(s => !s)} title="Posting language"
                className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${showLangMenu ? 'border-brand text-brand bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand hover:text-brand'}`}>
                {postLang === 'auto' ? 'Auto' : selectedLangLabel}
              </button>

            </div>

            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-200 dark:text-gray-700" />
                    <circle cx="10" cy="10" r="8" fill="none"
                      stroke={remain < 20 ? (remain < 0 ? '#ef4444' : '#f59e0b') : '#1d9bf0'}
                      strokeWidth="2" strokeDasharray={`${2 * Math.PI * 8}`}
                      strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct / 100)}`}
                      strokeLinecap="round" transform="rotate(-90 10 10)" />
                  </svg>
                  {remain <= 20 && <span className={`text-sm ${remain < 0 ? 'text-red-500' : 'text-gray-500'}`}>{remain}</span>}
                </div>
              )}
              <button onClick={handleSubmit} disabled={!canPost}
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
