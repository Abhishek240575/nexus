import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

export default function CookieBanner() {
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('deemona-cookie-consent');
    if (!accepted) setShow(true);
  }, []);

  const accept = async () => {
    localStorage.setItem('deemona-cookie-consent', '1');
    setShow(false);
    if (user) {
      api.post('/api/privacy/consents', { consent_type: 'cookies', granted: true }).catch(() => {});
    }
  };

  const decline = () => {
    localStorage.setItem('deemona-cookie-consent', '0');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl px-4 py-4 md:px-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">We value your privacy</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Deemona uses essential cookies for authentication and security, and optional cookies for analytics and personalisation.
            By clicking "Accept All", you consent to our use of cookies as described in our{' '}
            <Link to="/privacy" className="text-brand hover:underline">Privacy Policy</Link>.
            You can manage preferences in{' '}
            <Link to="/settings/privacy" className="text-brand hover:underline">Settings</Link>.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={decline}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Essential only
          </button>
          <button onClick={accept}
            className="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-full hover:bg-brand-dark transition-colors">
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
