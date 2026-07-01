import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api.client';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const redirect     = params.get('redirect') || '/';

    if (!accessToken || !refreshToken) {
      navigate('/login?error=oauth_failed');
      return;
    }

    // Store tokens and fetch user profile
    const init = async () => {
      try {
        // Temporarily set tokens in localStorage so api client can use them
        localStorage.setItem('deemona-auth', JSON.stringify({
          state: { accessToken, refreshToken, isAuth: true, user: null }
        }));

        // Fetch user profile
        const res = await api.get('/api/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = res.data.data;
        setAuth(user, accessToken, refreshToken);
        navigate(redirect, { replace: true });
      } catch {
        navigate('/login?error=oauth_failed');
      }
    };

    init();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-brand mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
