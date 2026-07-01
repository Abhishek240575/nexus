import { useState } from 'react';
import { Sparkles, Loader2, Check, X, ChevronDown } from 'lucide-react';
import { api } from '@/services/api.client';

interface AIWritingAssistantProps {
  text:    string;
  lang?:   string;
  onApply: (text: string) => void;
}

const ACTIONS = [
  { id: 'improve',      label: 'Improve writing',    emoji: '✨' },
  { id: 'shorten',      label: 'Make shorter',        emoji: '✂️' },
  { id: 'expand',       label: 'Expand',              emoji: '📝' },
  { id: 'hashtags',     label: 'Add hashtags',        emoji: '#️⃣' },
  { id: 'grammar',      label: 'Fix grammar',         emoji: '✅' },
  { id: 'formal',       label: 'Make formal',         emoji: '💼' },
  { id: 'casual',       label: 'Make casual',         emoji: '😊' },
  { id: 'translate_en', label: 'Translate to English', emoji: '🌐' },
] as const;

export default function AIWritingAssistant({ text, lang, onApply }: AIWritingAssistantProps) {
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState<string | null>(null);
  const [result,    setResult]    = useState<string | null>(null);
  const [error,     setError]     = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const assist = async (action: string) => {
    if (!text.trim()) { setError('Write something first'); return; }
    setLoading(action);
    setError('');
    setResult(null);
    setActiveAction(action);

    try {
      const res = await api.post('/api/ai/assist', { text, action, lang });
      setResult(res.data.data.result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'AI assistant failed. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const apply = () => {
    if (result) { onApply(result); setResult(null); setOpen(false); setActiveAction(null); }
  };

  const discard = () => { setResult(null); setActiveAction(null); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        title="AI Writing Assistant"
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
        <Sparkles size={13} />
        <span className="hidden sm:inline">AI Assist</span>
      </button>
    );
  }

  return (
    <div className="border border-purple-200 dark:border-purple-800 rounded-2xl bg-white dark:bg-gray-950 shadow-lg overflow-hidden mb-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">AI Writing Assistant</span>
        </div>
        <button onClick={() => { setOpen(false); setResult(null); setError(''); }}
          className="p-0.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
          <X size={13} className="text-purple-500" />
        </button>
      </div>

      {/* Result preview */}
      {result && (
        <div className="px-3 py-3 border-b border-purple-100 dark:border-purple-800">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Suggested rewrite:</p>
          <p className="text-sm text-gray-900 dark:text-white leading-relaxed bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            {result}
          </p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={apply}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors">
              <Check size={12} /> Apply
            </button>
            <button onClick={discard}
              className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-full text-xs hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              <X size={12} /> Discard
            </button>
            <button onClick={() => activeAction && assist(activeAction)}
              className="text-xs text-purple-500 hover:underline ml-1">
              Retry
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-2 flex flex-wrap gap-1.5">
        {ACTIONS.map(({ id, label, emoji }) => (
          <button key={id} onClick={() => assist(id)}
            disabled={!!loading}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
              activeAction === id && result
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-300'
            }`}>
            {loading === id
              ? <Loader2 size={11} className="animate-spin" />
              : <span>{emoji}</span>
            }
            {label}
          </button>
        ))}
      </div>

      {!text.trim() && (
        <p className="px-3 pb-2 text-xs text-gray-400">Start writing your post first, then use AI to improve it.</p>
      )}
    </div>
  );
}
