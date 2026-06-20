import { useForm }       from 'react-hook-form';
import { zodResolver }   from '@hookform/resolvers/zod';
import { z }             from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authService }   from '@/services/auth.service';
import { useAuthStore }  from '@/stores/auth.store';
import { connectSocket } from '@/services/socket';

const schema = z.object({
  handle:       z.string().min(3, 'At least 3 characters').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  email:        z.string().email('Invalid email'),
  display_name: z.string().min(1, 'Display name required').max(100),
  password:     z.string().min(8, 'At least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function Register() {
  const navigate    = useNavigate();
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authService.register(data);
      const { user, access_token, refresh_token } = res.data.data;
      setAuth(user, access_token, refresh_token);
      connectSocket();
      navigate('/onboarding');
    } catch (err: any) {
      setError('root', { message: err.response?.data?.error || 'Registration failed' });
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Join Deemona</h1>
      <p className="text-gray-500 mb-8">Create your account today.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: 'display_name' as const, placeholder: 'Display name',   type: 'text'     },
          { name: 'handle'       as const, placeholder: '@handle',         type: 'text'     },
          { name: 'email'        as const, placeholder: 'Email address',   type: 'email'    },
          { name: 'password'     as const, placeholder: 'Password (8+ chars)', type: 'password' },
        ].map(({ name, placeholder, type }) => (
          <div key={name}>
            <input
              {...register(name)}
              type={type}
              placeholder={placeholder}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors"
            />
            {errors[name] && (
              <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>
            )}
          </div>
        ))}

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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
