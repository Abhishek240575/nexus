import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, BadgeCheck, Zap, Crown, Building2, Loader2, X } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

declare global {
  interface Window { Razorpay: any; }
}

const billingService = {
  getTiers:    () => api.get('/api/billing/tiers'),
  getMine:     () => api.get('/api/billing/me'),
  checkout:    (tier_id: string) => api.post('/api/billing/checkout', { tier_id }),
  cancel:      () => api.post('/api/billing/cancel'),
};

const TIER_ICONS: Record<string, any> = {
  free:       Check,
  plus:       BadgeCheck,
  pro:        Zap,
  enterprise: Building2,
};

const TIER_TAGLINES: Record<string, string> = {
  free:       'Get started on Deemona',
  plus:       'For active voices who want to be seen',
  pro:        'For journalists, activists & influencers',
  enterprise: 'For organizations & newsrooms',
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Pricing() {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState(false);

  const { data: tiersData } = useQuery({ queryKey: ['tiers'], queryFn: billingService.getTiers });
  const { data: mineData }  = useQuery({ queryKey: ['my-subscription'], queryFn: billingService.getMine, enabled: !!user });

  const tiers      = tiersData?.data?.data ?? [];
  const mySub      = mineData?.data?.data;
  const currentTier = mySub?.tier_id || 'free';

  const handleSubscribe = async (tierId: string) => {
    if (!user) { window.location.href = '/login'; return; }
    setLoadingTier(tierId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { alert('Could not load payment gateway. Please try again.'); return; }

      const res = await billingService.checkout(tierId);
      const { razorpay_subscription_id } = res.data.data;

      const rzp = new window.Razorpay({
        key:            (window as any).__RAZORPAY_KEY_ID__ || '',
        subscription_id: razorpay_subscription_id,
        name:           'Deemona',
        description:    `${tierId.charAt(0).toUpperCase() + tierId.slice(1)} subscription`,
        theme:          { color: '#1d9bf0' },
        handler:        () => {
          queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
          alert('Subscription activated! Welcome to Deemona ' + tierId.charAt(0).toUpperCase() + tierId.slice(1) + '.');
        },
        modal: {
          ondismiss: () => setLoadingTier(null),
        },
      });
      rzp.open();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You will keep premium access until the end of the current billing period.')) return;
    setCancelling(true);
    try {
      await billingService.cancel();
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    } catch {
      alert('Could not cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deemona Premium</h1>
        <p className="text-sm text-gray-500 mt-1">Credibility, reach, and tools for serious voices</p>
      </div>

      {mySub && currentTier !== 'free' && (
        <div className="px-4 py-3 bg-brand/5 border-b border-brand/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-brand" />
            <span className="text-sm text-gray-900 dark:text-white">
              You're on <span className="font-semibold capitalize">{currentTier}</span>
              {mySub.cancel_at_period_end && <span className="text-gray-500"> (cancels at period end)</span>}
            </span>
          </div>
          {!mySub.cancel_at_period_end && (
            <button onClick={handleCancel} disabled={cancelling}
              className="text-xs text-red-500 hover:underline disabled:opacity-50">
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      <div className="px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier: any) => {
          const Icon       = TIER_ICONS[tier.id] || Check;
          const isCurrent  = tier.id === currentTier;
          const isFree     = tier.id === 'free';
          const priceRupees = tier.price_inr_paise / 100;

          return (
            <div key={tier.id}
              className={`rounded-2xl border-2 p-5 flex flex-col ${
                tier.id === 'pro' ? 'border-brand bg-brand/5' : 'border-gray-200 dark:border-gray-700'
              }`}>
              {tier.id === 'pro' && (
                <span className="self-start text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full mb-2">
                  MOST POPULAR
                </span>
              )}
              <div className="flex items-center gap-2 mb-1">
                <Icon size={20} className="text-brand" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{tier.display_name}</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">{TIER_TAGLINES[tier.id]}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                {isFree ? 'Free' : <>₹{priceRupees}<span className="text-sm font-normal text-gray-500">/month</span></>}
              </p>

              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-5 flex-1">
                <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Up to {tier.max_post_length} character posts</li>
                <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> {tier.max_space_listeners === -1 ? 'Unlimited' : tier.max_space_listeners} Space listeners</li>
                {tier.features.verified_badge && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Verified blue tick badge</li>}
                {tier.features.ads === false && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Ad-free experience</li>}
                {tier.features.analytics === 'advanced' && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Advanced analytics & demographics</li>}
                {tier.features.priority_visibility && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Priority visibility in feeds</li>}
                {tier.features.space_recording && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Record & archive Spaces</li>}
                {tier.features.ticketed_spaces && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Ticketed Spaces (monetize audio events)</li>}
                {tier.features.custom_branding && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Custom community branding</li>}
                {tier.features.compliance_dashboard && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Compliance & audit dashboard</li>}
                {tier.features.legal_protection_metadata && <li className="flex gap-2"><Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> Journalist legal protection metadata</li>}
              </ul>

              {isFree ? (
                <button disabled className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400">
                  Current plan
                </button>
              ) : isCurrent ? (
                <button disabled className="w-full py-2.5 rounded-full text-sm font-semibold bg-green-50 dark:bg-green-900/20 text-green-600">
                  ✓ Active plan
                </button>
              ) : (
                <button onClick={() => handleSubscribe(tier.id)} disabled={loadingTier === tier.id}
                  className="w-full py-2.5 rounded-full text-sm font-semibold bg-brand text-white hover:bg-brand-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loadingTier === tier.id ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : `Subscribe to ${tier.display_name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-8 text-xs text-gray-400 text-center">
        Payments processed securely via Razorpay. Cancel anytime — premium access continues until the end of your billing period.
      </div>
    </div>
  );
}
