import { useEffect }      from 'react';
import { useNavigate }    from 'react-router-dom';
import { useAuthStore }   from '@/stores/auth.store';
import { authService }    from '@/services/auth.service';
import { connectSocket }  from '@/services/socket';

export default function OAuthCallback() {
  const navigate    = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      navigate('/login?error=oauth_failed');
      return;
    }

    // Temporarily set tokens so getMe call works
    useAuthStore.getState().setTokens(accessToken, refreshToken);

    authService.getMe()
      .then(({ data }) => {
        setAuth(data.data, accessToken, refreshToken);
        connectSocket();
        navigate('/');
      })
      .catch(() => navigate('/login?error=oauth_failed'));
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
