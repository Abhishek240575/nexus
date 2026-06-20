import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

const STEP_LANGUAGE  = 0;
const STEP_INTERESTS = 1;
const STEP_FOLLOW    = 2;
const STEP_DONE      = 3;

const INTEREST_TAGS = [
  'Politics', 'Technology', 'Business', 'Sports', 'Entertainment',
  'Science', 'Health', 'Education', 'Environment', 'Finance',
  'Culture', 'Travel', 'Food', 'Fashion', 'Law & Justice',
  'Startups', 'Agriculture', 'Defence', 'Cinema', 'Music',
];

const LANGUAGES = [
  { code: 'en', label: 'English'   },
  { code: 'hi', label: 'Hindi'     },
  { code: 'ta', label: 'Tamil'     },
  { code: 'te', label: 'Telugu'    },
  { code: 'bn', label: 'Bengali'   },
  { code: 'mr', label: 'Marathi'   },
  { code: 'gu', label: 'Gujarati'  },
  { code: 'kn', label: 'Kannada'   },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi'   },
  { code: 'ur', label: 'Urdu'      },
  { code: 'ar', label: 'Arabic'    },
  { code: 'zh', label: 'Mandarin'  },
  { code: 'ru', label: 'Russian'   },
  { code: 'es', label: 'Spanish'   },
  { code: 'fr', label: 'French'    },
  { code: 'de', label: 'German'    },
];

export default function Onboarding() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const { user }      = useAuthStore();

  const [step,      setStep]      = useState(STEP_LANGUAGE);
  const [langs,     setLangs]     = useState<string[]>(['en']);
  const [interests, setInterests] = useState<string[]>([]);
  const [followed,  setFollowed]  = useState<string[]>([]);
  const [saving,    setSaving]    = useState(false);

  const { data: suggestData, isLoading: suggestLoading } = useQuery({
    queryKey: ['onboarding-suggestions'],
    queryFn:  () => api.get('/api/users/suggestions?limit=12'),
    enabled:  step === STEP_FOLLOW,
  });
  const suggestions = suggestData?.data?.data || [];

  const toggleLang = (code: string) => {
    setLangs(prev => prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]);
  };

  const toggleInterest = (tag: string) => {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleFollow = async (id: string) => {
    try {
      await api.post(`/api/users/${id}/follow`);
      setFollowed(prev => [...prev, id]);
    } catch { /* already following */ }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.post('/api/users/me/onboarding', { languages: langs, interests });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigate('/');
    } catch {
      navigate('/');
    }
  };

  const progress = ((step / STEP_DONE) * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div className="h-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-8">

        {/* Logo */}
        <div className="text-2xl font-black text-brand mb-8">Deemona</div>

        {/* STEP 0: Language */}
        {step === STEP_LANGUAGE && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose your languages</h1>
            <p className="text-gray-500 text-sm mb-6">Select the languages you want to read content in. You can change this later.</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => toggleLang(l.code)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    langs.includes(l.code)
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand'
                  }`}>
                  {langs.includes(l.code) && <Check size={12} className="inline mr-1" />}
                  {l.label}
                </button>
              ))}
            </div>
            <div className="mt-auto">
              <button onClick={() => setStep(STEP_INTERESTS)} disabled={langs.length === 0}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-full disabled:opacity-40 hover:opacity-90 transition-opacity">
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Interests */}
        {step === STEP_INTERESTS && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">What interests you?</h1>
            <p className="text-gray-500 text-sm mb-6">Pick at least 3 topics. Your feed will be tailored to your interests.</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {INTEREST_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleInterest(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    interests.includes(tag)
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand'
                  }`}>
                  {interests.includes(tag) && <Check size={12} className="inline mr-1" />}
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-auto flex gap-3">
              <button onClick={() => setStep(STEP_LANGUAGE)}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-full hover:bg-gray-50 dark:hover:bg-gray-900">
                Back
              </button>
              <button onClick={() => setStep(STEP_FOLLOW)} disabled={interests.length < 3}
                className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-full disabled:opacity-40 hover:opacity-90 transition-opacity">
                Next ({interests.length}/3 min)
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Follow suggestions */}
        {step === STEP_FOLLOW && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Follow some people</h1>
            <p className="text-gray-500 text-sm mb-6">Follow at least a few accounts to get your feed started.</p>

            {suggestLoading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-brand" /></div>}

            <div className="space-y-3 mb-6 flex-1 overflow-y-auto">
              {suggestions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <img src={s.avatar_url || `https://ui-avatars.com/api/?name=${s.handle}&background=1d9bf0&color=fff&size=40`}
                    className="w-10 h-10 rounded-full" alt={s.handle} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.display_name || s.handle}</p>
                    <p className="text-xs text-gray-500">@{s.handle}</p>
                  </div>
                  <button onClick={() => toggleFollow(s.id)} disabled={followed.includes(s.id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      followed.includes(s.id)
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-80'
                    }`}>
                    {followed.includes(s.id) ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
              {suggestions.length === 0 && !suggestLoading && (
                <p className="text-center text-gray-400 text-sm py-8">No suggestions yet — you can follow people later.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(STEP_INTERESTS)}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-full hover:bg-gray-50 dark:hover:bg-gray-900">
                Back
              </button>
              <button onClick={finish} disabled={saving}
                className="flex-1 bg-brand text-white font-bold py-3 rounded-full disabled:opacity-50 hover:bg-brand-dark transition-opacity">
                {saving ? 'Setting up…' : 'Start exploring'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
