import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, BadgeCheck, Zap, Crown, Building2, Loader2, X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { Link } from 'react-router-dom';

declare global { interface Window { Razorpay: any; } }

// ─── Load Razorpay Checkout.js script ────────────────────────────────────────
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src    = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const billingService = {
  getTiers:   () => api.get('/api/billing/tiers'),
  getMine:    () => api.get('/api/billing/me'),
  checkout:   (tier_id: string) => api.post('/api/billing/checkout', { tier_id }),
  verify:     (data: any) => api.post('/api/billing/verify', data),
  cancel:     () => api.post('/api/billing/cancel'),
};

const TIER_ICONS: Record<string, any> = {
  free:       Check,
  plus:       BadgeCheck,
  pro:        Zap,
  enterprise: Building2,
};

const TIER_COLORS: Record<string, string> = {
  free:       'border-gray-200 dark:border-gray-700',
  plus:       'border-brand',
  pro:        'border-amber-400',
  enterprise: 'border-purple-500',
};

const TIER_BADGE_COLORS: Record<string, string> = {
  plus:       'text-brand',
  pro:        'text-amber-500',
  enterprise: 'text-purple-500',
};

const TIER_TAGLINES: Record<string, string> = {
  free:       'Get started on Deemona',
  plus:       'For active voices who want to be seen',
  pro:        'For journalists, activists & influencers',
  enterprise: 'For organizations & newsrooms',
};

export default function Pricing() {
  const { user, refreshUser } = useAuthStore() as any;
  const queryClient  = useQueryClient();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const { data: tiersData } = useQuery({ queryKey: ['tiers'],            queryFn: billingService.getTiers });
  const { data: mineData  } = useQuery({ queryKey: ['my-subscription'],  queryFn: billingService.getMine, enabled: !!user });

  const tiers       = tiersData?.data?.data ?? [];
  const mySub       = mineData?.data?.data;
  const currentTier = mySub?.tier_id || user?.premium_tier || 'free';

  const handleSubscribe = async (tierId: string) => {
    if (!user) { window.location.href = '/login'; return; }
    setLoadingTier(tierId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Load Razorpay checkout script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setErrorMsg('Could not load payment gateway. Please check your connection and try again.');
        setLoadingTier(null);
        return;
      }

      // 2. Create subscription on backend → get subscription ID + key
      const res = await billingService.checkout(tierId);
      const { razorpay_subscription_id, razorpay_key_id } = res.data.data;

      if (!razorpay_key_id) {
        setErrorMsg('Payment gateway not configured. Please contact support.');
        setLoadingTier(null);
        return;
      }

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key:             razorpay_key_id,
        subscription_id: razorpay_subscription_id,
        name:            'Deemona',
        description:     `${tierId.charAt(0).toUpperCase() + tierId.slice(1)} subscription`,
        image:           'https://nexus-web-bjks.onrender.com/favicon.ico',
        theme:           { color: '#1d9bf0' },

        // 4. On payment success — verify immediately with backend
        handler: async (response: any) => {
          try {
            const verifyRes = await billingService.verify({
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:       response.razorpay_signature,
            });

            const { tier_id, message } = verifyRes.data.data;
            setSuccessMsg(message || `Welcome to Deemona ${tier_id}!`);

            // Refresh all relevant queries
            queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
            queryClient.invalidateQueries({ queryKey: ['tiers'] });

            // Refresh user in auth store if method exists
            if (typeof refreshUser === 'function') await refreshUser();

          } catch (verifyErr: any) {
            // Payment was captured but verification call failed
            // This is handled by webhook as fallback — tell user to refresh
            setSuccessMsg('Payment successful! Your subscription will activate within a few seconds. Please refresh the page.');
          }
          setLoadingTier(null);
        },

        // 5. On modal close without payment
        modal: {
          ondismiss: () => {
            setLoadingTier(null);
            setErrorMsg('');
          },
          confirm_close: true,
          escape: false,
        },

        // Prefill user details
        prefill: {
          name:  user.display_name || user.handle,
          email: user.email,
        },
      });

      rzp.on('payment.failed', (response: any) => {
        setErrorMsg(`Payment failed: ${response.error?.description || 'Unknown error'}. Please try again.`);
        setLoadingTier(null);
      });

      rzp.open();

    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not start checkout. Please try again.';
      setErrorMsg(msg);
      setLoadingTier(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You will keep premium access until the end of the current billing period.')) return;
    setCancelling(true);
    setErrorMsg('');
    try {
      await billingService.cancel();
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      setSuccessMsg('Subscription cancelled. Your access continues until the end of the current billing period.');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Could not cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deemona Premium</h1>
        <p className="text-sm text-gray-500 mt-1">Credibility, reach, and tools for serious voices</p>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mx-4 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-start gap-3">
          <Check size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMsg}</p>
            <Link to="/" className="text-xs text-green-600 hover:underline mt-1 block">Go to home →</Link>
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Active subscription banner */}
      {mySub && currentTier !== 'free' && (
        <div className="mx-4 mt-4 px-4 py-3 bg-brand/5 border border-brand/20 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} className={TIER_BADGE_COLORS[currentTier] || 'text-brand'} />
            <span className="text-sm text-gray-900 dark:text-white">
              You're on <span className="font-semibold capitalize">{currentTier}</span>
              {mySub.cancel_at_period_end && (
                <span className="text-gray-400 ml-1 text-xs">(cancels at period end)</span>
              )}
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

      {/* Tier cards */}
      <div className="px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier: any) => {
          const Icon        = TIER_ICONS[tier.id] || Check;
          const isCurrent   = tier.id === currentTier;
          const isFree      = tier.id === 'free';
          const priceRupees = tier.price_inr_paise / 100;
          const isPopular   = tier.id === 'pro';

          return (
            <div key={tier.id}
              className={`rounded-2xl border-2 p-5 flex flex-col transition-all ${TIER_COLORS[tier.id] || 'border-gray-200 dark:border-gray-700'} ${isPopular ? 'shadow-lg shadow-brand/10' : ''}`}>

              {isPopular && (
                <span className="self-start text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full mb-2">
                  MOST POPULAR
                </span>
              )}

              <div className="flex items-center gap-2 mb-1">
                <Icon size={20} className={TIER_BADGE_COLORS[tier.id] || 'text-gray-400'} />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{tier.display_name}</h2>
              </div>

              <p className="text-xs text-gray-500 mb-3">{TIER_TAGLINES[tier.id]}</p>

              <p className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                {isFree ? 'Free' : <>
                  ₹{priceRupees}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </>}
              </p>

              {/* Feature list */}
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-5 flex-1">
                <li className="flex gap-2">
                  <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                  Up to {tier.max_post_length} character posts
                </li>
                <li className="flex gap-2">
                  <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                  {tier.max_space_listeners === -1 ? 'Unlimited' : tier.max_space_listeners} Space listeners
                </li>
                {tier.features?.verified_badge && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Verified badge
                  </li>
                )}
                {tier.features?.ads === false && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Ad-free experience
                  </li>
                )}
                {tier.features?.analytics === 'advanced' && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Advanced analytics (90-day history)
                  </li>
                )}
                {tier.features?.priority_visibility && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Priority visibility in feeds
                  </li>
                )}
                {tier.features?.space_recording && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Record and archive Spaces
                  </li>
                )}
                {tier.features?.ticketed_spaces && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Ticketed Spaces (monetize audio events)
                  </li>
                )}
                {tier.features?.custom_branding && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Custom community branding
                  </li>
                )}
                {tier.features?.compliance_dashboard && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Compliance and audit dashboard
                  </li>
                )}
                {tier.features?.legal_protection_metadata && (
                  <li className="flex gap-2">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    Journalist legal protection metadata
                  </li>
                )}
              </ul>

              {/* CTA button */}
              {isFree ? (
                <button disabled
                  className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default">
                  Current plan
                </button>
              ) : isCurrent ? (
                <button disabled
                  className="w-full py-2.5 rounded-full text-sm font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 cursor-default">
                  ✓ Active plan
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loadingTier === tier.id}
                  className={`w-full py-2.5 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    isPopular ? 'bg-brand hover:bg-brand-dark' : 'bg-gray-900 dark:bg-white dark:text-black hover:opacity-90'
                  }`}>
                  {loadingTier === tier.id
                    ? <><Loader2 size={14} className="animate-spin" /> Starting checkout…</>
                    : `Subscribe to ${tier.display_name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 pb-8 text-center">
        <p className="text-xs text-gray-400 mb-1">
          Payments processed securely via Razorpay · Supports cards and UPI Autopay
        </p>
        <p className="text-xs text-gray-400">
          Cancel anytime — premium access continues until end of billing period · No refunds for partial months
        </p>
      </div>
    </div>
  );
}
