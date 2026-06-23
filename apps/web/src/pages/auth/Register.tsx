import { useState }     from 'react';
import { useForm }       from 'react-hook-form';
import { zodResolver }   from '@hookform/resolvers/zod';
import { z }             from 'zod';
import { Link }          from 'react-router-dom';
import { authService }   from '@/services/auth.service';
import { Mail }          from 'lucide-react';
import LegalModal        from '@/components/common/LegalModal';

const schema = z.object({
  handle:       z.string().min(3, 'At least 3 characters').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  email:        z.string().email('Invalid email'),
  display_name: z.string().min(1, 'Display name required').max(100),
  password:     z.string().min(8, 'At least 8 characters'),
  consent:      z.literal(true, { errorMap: () => ({ message: 'You must accept both Terms of Service and Privacy Policy to continue' }) }),
});
type FormData = z.infer<typeof schema>;

export default function Register() {
  const [verifyEmail,    setVerifyEmail]    = useState('');
  const [modal,          setModal]          = useState<'terms' | 'privacy' | null>(null);
  const [termsAccepted,  setTermsAccepted]  = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const bothAccepted = termsAccepted && privacyAccepted;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Keep zod consent in sync
  const syncConsent = (terms: boolean, privacy: boolean) => {
    if (terms && privacy) {
      setValue('consent', true, { shouldValidate: true });
    } else {
      setValue('consent', false as any, { shouldValidate: false });
    }
  };

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setModal(null);
    syncConsent(true, privacyAccepted);
  };

  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true);
    setModal(null);
    syncConsent(termsAccepted, true);
  };

  const onSubmit = async (data: FormData) => {
    if (!bothAccepted) {
      setError('consent', { message: 'You must accept both Terms of Service and Privacy Policy to continue' });
      return;
    }
    try {
      await authService.register(data as { handle: string; email: string; password: string; display_name?: string });
      setVerifyEmail(data.email);
    } catch (err: any) {
      setError('root', { message: err.response?.data?.error || 'Registration failed' });
    }
  };

  // ── Step 2: Verify email screen ───────────────────────────────────────────────
  if (verifyEmail) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail size={28} className="text-brand" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h1>
        <p className="text-gray-500 text-sm mb-1">We sent a verification link to</p>
        <p className="font-semibold text-gray-900 dark:text-white mb-6">{verifyEmail}</p>
        <p className="text-gray-400 text-xs mb-8">
          Click the link in the email to verify your account, then sign in.
          The link expires in 24 hours.
        </p>
        <Link to="/login"
          className="block w-full bg-brand text-white font-semibold py-3 rounded-full text-sm hover:bg-brand-dark transition-colors text-center">
          Go to Sign in
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          Did not receive the email? Check your spam folder or{' '}
          <button onClick={() => setVerifyEmail('')} className="text-brand hover:underline">
            try again
          </button>
        </p>
      </div>
    );
  }

  // ── Step 1: Registration form ──────────────────────────────────────────────────
  return (
    <>
      {/* Legal modals */}
      {modal === 'terms'   && <LegalModal type="terms"   onAccept={handleTermsAccept}   onClose={() => setModal(null)} />}
      {modal === 'privacy' && <LegalModal type="privacy" onAccept={handlePrivacyAccept} onClose={() => setModal(null)} />}

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Join Deemona</h1>
        <p className="text-gray-500 mb-6">Create your account today.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            { name: 'display_name' as const, placeholder: 'Display name',       type: 'text'     },
            { name: 'handle'       as const, placeholder: '@handle',             type: 'text'     },
            { name: 'email'        as const, placeholder: 'Email address',       type: 'email'    },
            { name: 'password'     as const, placeholder: 'Password (8+ chars)', type: 'password' },
          ].map(({ name, placeholder, type }) => (
            <div key={name}>
              <input {...register(name)} type={type} placeholder={placeholder}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors" />
              {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
            </div>
          ))}

          {errors.root && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
              {errors.root.message}
            </div>
          )}

          {/* Legal acceptance (GDPR/DPDP — must read before accepting) */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Required agreements</p>

            {/* Terms of Service */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0">
                {termsAccepted
                  ? <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  : <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                }
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">Terms of Service</span>
              </div>
              <button type="button" onClick={() => setModal('terms')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${
                  termsAccepted
                    ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                    : 'text-white bg-brand hover:bg-brand-dark'
                }`}>
                {termsAccepted ? 'Accepted' : 'Read & Accept'}
              </button>
            </div>

            {/* Privacy Policy */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0">
                {privacyAccepted
                  ? <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  : <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                }
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">Privacy Policy</span>
              </div>
              <button type="button" onClick={() => setModal('privacy')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${
                  privacyAccepted
                    ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                    : 'text-white bg-brand hover:bg-brand-dark'
                }`}>
                {privacyAccepted ? 'Accepted' : 'Read & Accept'}
              </button>
            </div>

            {errors.consent && <p className="text-red-500 text-xs">{errors.consent.message}</p>}
            {!bothAccepted && (
              <p className="text-xs text-gray-400">You must read and accept both documents to create an account.</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting || !bothAccepted}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-full transition-colors">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By creating an account you confirm you are 18+ years old and agree to be bound by these terms.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </>
  );
}
