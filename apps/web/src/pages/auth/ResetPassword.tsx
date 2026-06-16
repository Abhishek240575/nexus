import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api.client';

export default function ResetPassword() {
  const [searchParams]              = useSearchParams();
  const token                       = searchParams.get('token');
  const navigate                    = useNavigate();
  const [password,    setPassword]  = useState('');
  const [confirm,     setConfirm]   = useState('');
  const [showPwd,     setShowPwd]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]   = useState(false);
  const [done,        setDone]      = useState(false);
  const [error,       setError]     = useState('');

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8)            s++;
    if (/[A-Z]/.test(password))          s++;
    if (/[0-9]/.test(password))          s++;
    if (/[^A-Za-z0-9]/.test(password))  s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    if (!token)               { setError('Invalid reset link'); return; }

    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle size={48} className="mx-auto mb-4 text-orange-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid reset link</h2>
          <p className="text-gray-500 text-sm mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-brand hover:underline text-sm font-medium">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-brand mb-2">Deemona</h1>
        </div>

        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Password updated!</h2>
            <p className="text-gray-500 text-sm mb-2">Your password has been reset successfully.</p>
            <p className="text-xs text-gray-400">Redirecting to login in 3 secondsâ€¦</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reset password</h2>
            <p className="text-gray-500 text-sm mb-6">Choose a strong new password for your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoFocus
                    required
                    className="w-full pl-9 pr-10 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-brand transition-colors"
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-700'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-orange-400' : strength === 3 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {strengthLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className={`w-full pl-9 pr-10 py-3 border rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none transition-colors ${
                      confirm && confirm !== password
                        ? 'border-red-400 focus:border-red-400'
                        : confirm && confirm === password
                        ? 'border-green-400 focus:border-green-400'
                        : 'border-gray-200 dark:border-gray-700 focus:border-brand'
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>
              )}

              <button type="submit"
                disabled={!password || !confirm || password !== confirm || loading}
                className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Updatingâ€¦</> : 'Reset password'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/login" className="text-gray-400 hover:text-brand text-sm transition-colors">
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
