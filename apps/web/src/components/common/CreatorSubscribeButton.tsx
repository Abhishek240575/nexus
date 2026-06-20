import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Loader2, Check } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

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

const creatorSubService = {
  getInfo:    (handle: string) => api.get(`/api/monetization/creator-sub/${handle}`),
  createOrder:(handle: string) => api.post(`/api/monetization/creator-sub/${handle}/order`),
  confirm:    (handle: string, data: any) => api.post(`/api/monetization/creator-sub/${handle}/confirm`, data),
  cancel:     (handle: string) => api.delete(`/api/monetization/creator-sub/${handle}`),
};

export default function CreatorSubscribeButton({ handle }: { handle: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['creator-sub-info', handle],
    queryFn:  () => creatorSubService.getInfo(handle),
    enabled:  !!handle,
  });

  const info = data?.data?.data;

  // Don't show if creator hasn't enabled subscriptions
  if (isLoading || !info?.creator?.creator_subscription_enabled) return null;
  // Don't show on own profile
  if (user?.handle === handle) return null;

  const priceInr = (info.creator.creator_subscription_price || 0) / 100;
  const isSubscribed = info.is_subscribed;

  const handleSubscribe = async () => {
    if (!user) { window.location.href = '/login'; return; }
    setLoading(true);
    setError('');

    try {
      const loaded = await loadRazorpay();
      if (!loaded) { setError('Could not load payment gateway'); setLoading(false); return; }

      const orderRes = await creatorSubService.createOrder(handle);
      const { order_id, amount, key_id, creator_name } = orderRes.data.data;

      const rzp = new window.Razorpay({
        key:         key_id,
        order_id,
        amount,
        currency:    'INR',
        name:        'Deemona',
        description: `Subscribe to ${creator_name}`,
        theme:       { color: '#1d9bf0' },
        prefill:     { name: user.display_name || user.handle, email: user.email },
        handler: async (response: any) => {
          try {
            await creatorSubService.confirm(handle, {
              order_id:   response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature:  response.razorpay_signature,
            });
            setSuccess(`Subscribed to ${creator_name}!`);
            queryClient.invalidateQueries({ queryKey: ['creator-sub-info', handle] });
          } catch {
            setError('Payment captured but activation failed. Please contact support.');
          }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.on('payment.failed', () => { setError('Payment failed. Please try again.'); setLoading(false); });
      rzp.open();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not start checkout');
      setLoading(false);
    }
  };

  const cancelMutation = useMutation({
    mutationFn: () => creatorSubService.cancel(handle),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['creator-sub-info', handle] });
      setSuccess('Subscription cancelled.');
    },
    onError: () => setError('Could not cancel. Please try again.'),
  });

  return (
    <div className="mt-3">
      {error   && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {success && <p className="text-xs text-green-500 mb-2">{success}</p>}

      {isSubscribed ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check size={14} /> Subscribed
          </span>
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="text-xs text-gray-400 hover:text-red-500 underline">
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
            : <><Crown size={14} /> Subscribe ₹{priceInr}/month</>}
        </button>
      )}

      <p className="text-xs text-gray-400 mt-1">
        {info.creator.creator_subscriber_count} subscriber{info.creator.creator_subscriber_count !== 1 ? 's' : ''}
        {isSubscribed && ' · Access to exclusive posts'}
      </p>
    </div>
  );
}
