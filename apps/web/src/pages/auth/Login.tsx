import { useForm }       from 'react-hook-form';
import { zodResolver }   from '@hookform/resolvers/zod';
import { z }             from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService }   from '@/services/auth.service';
import { useAuthStore }  from '@/stores/auth.store';
import { connectSocket } from '@/services/socket';

const schema = z.object({
  identifier: z.string().min(1, 'Email or handle required'),
  password:   z.string().min(1, 'Password required'),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const verified   = params.get('verified') === '1';
  const tokenError = params.get('error');

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authService.login(data as { identifier: string; password: string });
      const { user, access_token, refresh_token } = res.data.data;
      setAuth(user, access_token, refresh_token);
      connectSocket();
      navigate(user.is_onboarded === false ? '/onboarding' : '/');
    } catch (err: any) {
      setError('root', { message: err.response?.data?.error || 'Login failed' });
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Sign in to Deemona</h1>

      {verified && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-xl px-4 py-3 mb-6">
          Email verified successfully! You can now sign in.
        </div>
      )}
      {tokenError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
          {tokenError === 'expired_token' ? 'Verification link has expired. Please register again.' : 'Invalid verification link.'}
        </div>
      )}
      <p className="text-gray-500 mb-8">Welcome back!</p>

      {/* OAuth */}
      <a
        href={`${import.meta.env.VITE_API_URL}/api/auth/google`}
        className="flex items-center justify-center gap-3 w-full border border-gray-300 dark:border-gray-700 rounded-full py-3 text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors mb-3"
      >
        Sign in with Google
      </a>
      <a
        href={`${import.meta.env.VITE_API_URL}/api/auth/github`}
        className="flex items-center justify-center gap-3 w-full border border-gray-300 dark:border-gray-700 rounded-full py-3 text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors mb-6"
      >
        Sign in with GitHub
      </a>

      <div className="flex items-center gap-4 mb-6">
        <hr className="flex-1 border-gray-200 dark:border-gray-800" />
        <span className="text-sm text-gray-400">or</span>
        <hr className="flex-1 border-gray-200 dark:border-gray-800" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input
            {...register('identifier')}
            placeholder="Email or @handle"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors"
          />
          {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>}
        </div>

        <div>
          <input
            {...register('password')}
            type="password"
            placeholder="Password"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {errors.root && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
            {errors.root.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-semibold py-3 rounded-full transition-colors"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link to="/forgot-password" className="text-sm text-brand hover:underline">
          Forgot password?
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
