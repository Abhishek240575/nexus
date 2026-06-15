import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query';
import { ReactQueryDevtools as QueryDevtools } from '@tanstack/react-query-devtools';
import { useAuthStore }  from '@/stores/auth.store';

// Layouts
import AppLayout   from '@/components/layout/AppLayout';
import AuthLayout  from '@/components/layout/AuthLayout';

// Pages â€” lazy loaded
import { lazy, Suspense } from 'react';
const Home          = lazy(() => import('@/pages/Home'));
const Explore       = lazy(() => import('@/pages/Explore'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Messages      = lazy(() => import('@/pages/Messages'));
const Profile       = lazy(() => import('@/pages/Profile'));
const PostDetail    = lazy(() => import('@/pages/PostDetail'));
const Communities   = lazy(() => import('@/pages/Communities'));
const Spaces        = lazy(() => import('@/pages/Spaces'));
const Debates       = lazy(() => import('@/pages/Debates'));
const Analytics    = lazy(() => import('@/pages/Analytics'));
const Trending      = lazy(() => import('@/pages/Trending'));
const CommunityMod  = lazy(() => import('@/pages/CommunityMod'));
const Bookmarks    = lazy(() => import('@/pages/Bookmarks'));
const Settings      = lazy(() => import('@/pages/Settings'));
const ModerationPanel = lazy(() => import('@/pages/ModerationPanel'));
const Login         = lazy(() => import('@/pages/auth/Login'));
const Register      = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword  = lazy(() => import('@/pages/auth/ResetPassword'));
const OAuthCallback  = lazy(() => import('@/pages/auth/OAuthCallback'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        1000 * 60,
      retry:            1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = useAuthStore((s) => s.isAuth);
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = useAuthStore((s) => s.isAuth);
  return !isAuth ? <>{children}</> : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register"        element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
              <Route path="/reset-password"  element={<GuestRoute><ResetPassword /></GuestRoute>} />
              <Route path="/auth/callback"   element={<OAuthCallback />} />
            </Route>

            {/* App routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index                      element={<Home />} />
              <Route path="/explore"            element={<Explore />} />
              <Route path="/notifications"      element={<Notifications />} />
              <Route path="/messages"           element={<Messages />} />
              <Route path="/messages/:id"       element={<Messages />} />
              <Route path="/:handle"            element={<Profile />} />
              <Route path="/:handle/post/:id"   element={<PostDetail />} />
              <Route path="/bookmarks"            element={<Bookmarks />} />
              <Route path="/communities/:slug"  element={<Communities />} />
              <Route path="/communities/:slug/mod" element={<CommunityMod />} />
              <Route path="/spaces"             element={<Spaces />} />
              <Route path="/spaces/:id"         element={<Spaces />} />
              <Route path="/debates"            element={<Debates />} />
              <Route path="/debates/:id"        element={<Debates />} />
              <Route path="/analytics"          element={<Analytics />} />
              <Route path="/trending"           element={<Trending />} />
              <Route path="/moderation"         element={<ModerationPanel />} />
              <Route path="/settings"           element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      {import.meta.env.DEV && <QueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
