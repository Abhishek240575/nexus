import { useState }        from 'react';
import { useAuthStore }    from '@/stores/auth.store';
import { usersService }    from '@/services/posts.service';
import { useQueryClient }  from '@tanstack/react-query';
import { Camera, Loader2 } from 'lucide-react';

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
        </div>
      </div>
    </div>
  );
}
