import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Zap, Crown, Building2, Loader2, X } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { Link, useNavigate } from 'react-router-dom';

declare global { interface Window { Razorpay: any; } }

function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const billingService = {
  getTiers: () => api.get('/api/billing/tiers'),
  getMine:  () => api.get('/api/billing/me'),
  checkout: (tier_id: string) => api.post('/api/billing/checkout', { tier_id }),
  verify:   (data: any) => api.post('/api/billing/verify', data),
  cancel:   () => api.post('/api/billing/cancel'),
};

const TIER_ICONS: Record<string, any> = { free: null, plus: Zap, pro: Crown, enterprise: Building2 };

const TIER_COLORS: Record<string, string> = {
  free:       'border-gray-200 dark:border-gray-700',
  plus:       'border-blue-400 dark:border-blue-500',
  pro:        'border-purple-500 dark:border-purple-400',
  enterprise: 'border-amber-500 dark:border-amber-400',
};

const TIER_BADGE: Record<string, string> = {
  free:       'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  plus:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pro:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const TIER_TAGLINES: Record<string, string> = {
  free:       'Get started for free',
  plus:       'For active creators',
  pro:        'For serious voices',
  enterprise: 'For organisations and teams',
};

const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'Up to 280 character posts',
    'Follow up to 5,000 accounts',
    'Basic feed',
    'Community access',
    'Standard notifications',
  ],
  plus: [
    'Up to 1,000 character posts',
    'Verified Plus badge',
    'Advanced analytics dashboard',
    'Priority in search results',
    'Short video uploads (30s)',
    'Creator subscriptions',
    'Bookmark folders',
    'Undo post (30s window)',
  ],
  pro: [
    'Everything in Plus',
    'Pro badge + journalist eligibility',
    'Space recording and playback',
    'Exclusive subscriber-only posts',
    'Revenue dashboard',
    'AI writing assistant (unlimited)',
    'Custom post scheduling',
    'API access (coming soon)',
  ],
  enterprise: [
    'Everything in Pro',
    'Organisation page',
    'Team member management',
    'Compliance dashboard',
    'Audit logs',
    'Priority support',
    'Custom branding options',
    'Dedicated account manager',
  ],
};

export default function Pricing() {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: tiersData } = useQuery({ queryKey: ['tiers'],            queryFn: billingService.getTiers });
  const { data: mineData  } = useQuery({ queryKey: ['my-subscription'],  queryFn: billingService.getMine, enabled: !!user });

  const tiers  = tiersData?.data?.data ?? [];
  const myTier = user?.premium_tier || 'free';
  const mySub  = mineData?.data?.data;

  const cancelMutation = useMutation({
    mutationFn: billingService.cancel,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['my-subscription'] }),
  });

  const handleSubscribe = async (tier: any) => {
    if (!user) { navigate('/login'); return; }
    if (tier.name === 'free' || tier.name === myTier) return;
    setLoadingTier(tier.name);
    setError('');
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { setError('Could not load payment gateway.'); return; }
      const res = await billingService.checkout(tier.name);
      const { order_id, amount } = res.data.data;
      const options = {
        key:         import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount, currency: 'INR',
        name:        'Deemona',
        description: `${tier.name} Subscription`,
        order_id,
        handler: async (response: any) => {
          try {
            await billingService.verify({ ...response, tier: tier.name });
            queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
            navigate('/');
          } catch { setError('Payment verification failed.'); }
        },
        prefill: { email: user.email },
        theme:   { color: '#1d9bf0' },
      };
      new window.Razorpay(options).open();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-5xl mx-auto px-4 py-12">

        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">Deemona Premium</h1>
          <p className="text-gray-500 text-lg">Credibility, reach, and tools for serious voices</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 mb-8 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <X size={16} /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {tiers.map((tier: any) => {
            const Icon      = TIER_ICONS[tier.name];
            const isCurrent = myTier === tier.name;
            const isLoading = loadingTier === tier.name;
            const features  = TIER_FEATURES[tier.name] || [];

            return (
              <div key={tier.name}
                className={`rounded-3xl border-2 p-6 flex flex-col ${TIER_COLORS[tier.name]} ${isCurrent ? 'ring-2 ring-brand ring-offset-2 dark:ring-offset-black' : ''}`}>

                <div className="flex items-center gap-2 mb-2">
                  {Icon && <Icon size={18} className="text-brand" />}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${TIER_BADGE[tier.name]}`}>
                    {tier.name}
                  </span>
                  {isCurrent && <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full ml-auto">Current</span>}
                </div>

                <p className="text-xs text-gray-500 mb-4">{TIER_TAGLINES[tier.name]}</p>

                <div className="mb-5">
                  {tier.price_inr_monthly === 0 ? (
                    <p className="text-3xl font-black text-gray-900 dark:text-white">Free</p>
                  ) : (
                    <p className="text-3xl font-black text-gray-900 dark:text-white">
                      ₹{tier.price_inr_monthly}<span className="text-sm font-normal text-gray-500">/month</span>
                    </p>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check size={14} className="text-brand mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                {tier.name === 'free' ? (
                  isCurrent ? (
                    <button disabled className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default">Current plan</button>
                  ) : (
                    <Link to="/register" className="block w-full py-2.5 rounded-full text-sm font-semibold text-center bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90">Get started free</Link>
                  )
                ) : isCurrent ? (
                  <div className="space-y-2">
                    <button disabled className="w-full py-2.5 rounded-full text-sm font-semibold bg-brand/10 text-brand cursor-default">Current plan</button>
                    {mySub && !mySub.cancel_at_period_end && (
                      <button onClick={() => cancelMutation.mutate()} className="w-full py-2 rounded-full text-xs text-gray-400 hover:text-red-500 transition-colors">Cancel subscription</button>
                    )}
                    {mySub?.cancel_at_period_end && <p className="text-xs text-center text-orange-500">Cancels at period end</p>}
                  </div>
                ) : !user ? (
                  <Link to="/login" className="block w-full py-2.5 rounded-full text-sm font-semibold text-center bg-brand text-white hover:bg-brand-dark">Subscribe to {tier.name}</Link>
                ) : (
                  <button onClick={() => handleSubscribe(tier)} disabled={!!loadingTier}
                    className="w-full py-2.5 rounded-full text-sm font-semibold bg-brand text-white hover:bg-brand-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {isLoading ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Subscribe to ${tier.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400">
          Payments processed securely via Razorpay · Supports cards and UPI Autopay<br />
          Cancel anytime — premium access continues until end of billing period
        </p>

      </div>
    </div>
  );
}
