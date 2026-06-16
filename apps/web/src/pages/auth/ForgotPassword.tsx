import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/services/api.client';

export default function ForgotPassword() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-brand mb-2">Deemona</h1>
        </div>

        {sent ? (
          /* Success state */
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm mb-6">
              If <span className="font-medium text-gray-900 dark:text-white">{email}</span> is registered on Deemona, you'll receive a password reset link shortly.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              The link expires in 1 hour. Check your spam folder if you don't see it.
            </p>
            <Link to="/login"
              className="flex items-center justify-center gap-2 text-brand hover:underline text-sm font-medium">
              <ArrowLeft size={14} /> Back to login
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Forgot password?</h2>
            <p className="text-gray-500 text-sm mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                    className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>
              )}

              <button type="submit" disabled={!email.trim() || loading}
                className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sendingâ€¦</> : 'Send reset link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login"
                className="flex items-center justify-center gap-2 text-gray-500 hover:text-brand transition-colors text-sm">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
