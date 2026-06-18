import { useState }        from 'react';
import { Link }            from 'react-router-dom';
import { useAuthStore }    from '@/stores/auth.store';
import { usersService }    from '@/services/posts.service';
import { useQueryClient }  from '@tanstack/react-query';
import { Camera, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore }   from '@/stores/theme.store';

function ThemeSelector() {
  const { theme, setTheme } = useThemeStore();
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark',  label: 'Dark',  icon: Moon },
    { value: 'system',label: 'System',icon: Monitor },
  ] as const;
  return (
    <div className="flex gap-3">
      {options.map(({ value, label, icon: Icon }) => (
        <button key={value} onClick={() => setTheme(value)}
          className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${
            theme === value
              ? 'border-brand bg-brand/5 text-brand'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
          }`}>
          <Icon size={20} />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const queryClient       = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio:          '',
    location:     '',
    website:      '',
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await usersService.updateProfile(form);
      setUser(data.data);
      queryClient.invalidateQueries({ queryKey: ['profile', user?.handle] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="px-4 py-6 max-w-lg">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Edit profile</h2>

        <div className="space-y-4">
          {[
            { key: 'display_name', label: 'Display name',  placeholder: 'Your name',        max: 100 },
            { key: 'bio',          label: 'Bio',            placeholder: 'About you',         max: 160 },
            { key: 'location',     label: 'Location',       placeholder: 'Where are you?',    max: 100 },
            { key: 'website',      label: 'Website',        placeholder: 'https://yoursite.com', max: 255 },
          ].map(({ key, label, placeholder, max }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              {key === 'bio' ? (
                <textarea
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  maxLength={max}
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none transition-colors"
                />
              ) : (
                <input
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  maxLength={max}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="mt-6 w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition-colors">
          {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Saving…</span> : saved ? '✓ Saved' : 'Save changes'}
        </button>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Account</h2>
          <p className="text-sm text-gray-500 mb-4">@{user?.handle} · {user?.email}</p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>Premium tier: <span className="font-medium text-gray-900 dark:text-white capitalize">{user?.premium_tier}</span></p>
            <p>Verified: <span className="font-medium text-gray-900 dark:text-white">{user?.verified ? 'Yes' : 'No'}</span></p>
          </div>
          <Link to="/premium" className="inline-block mt-3 text-sm text-brand hover:underline font-medium">
            {user?.premium_tier === 'free' ? 'Upgrade to Premium →' : 'Manage subscription →'}
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}
