import { useState } from 'react';
import { Gift, Loader2, X } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';

declare global {
  interface Window { Razorpay: any; }
}

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

const PRESET_AMOUNTS = [10, 50, 100, 500];

export default function TipButton({ toHandle, postId }: { toHandle: string; postId?: string }) {
  const { user } = useAuthStore();
  const [open,    setOpen]    = useState(false);
  const [amount,  setAmount]  = useState(50);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);

  if (!user || user.handle === toHandle) return null;

  const handleTip = async () => {
    setSending(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { alert('Could not load payment gateway.'); setSending(false); return; }

      const orderRes = await api.post('/api/monetization/tips/order', {
        to_handle: toHandle, amount_inr: amount, post_id: postId,
      });
      const { order_id, key_id } = orderRes.data.data;

      const rzp = new window.Razorpay({
        key:         key_id,
        order_id,
        amount:      amount * 100,
        currency:    'INR',
        name:        'Deemona',
        description: `Tip to @${toHandle}`,
        theme:       { color: '#1d9bf0' },
        handler:     async (response: any) => {
          await api.post('/api/monetization/tips/confirm', {
            order_id:   response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature:  response.razorpay_signature,
            to_handle:  toHandle,
            amount_inr: amount,
            post_id:    postId,
            message:    message || undefined,
          });
          setDone(true);
          setSending(false);
        },
        modal: { ondismiss: () => setSending(false) },
      });
      rzp.open();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not send tip');
      setSending(false);
    }
  };

  return (
    <>
      <button onClick={e => { e.preventDefault(); setOpen(true); }} title="Send a tip"
        className="p-2 rounded-full text-gray-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
        <Gift size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-sm">
            {done ? (
              <div className="text-center py-4">
                <Gift size={36} className="mx-auto mb-2 text-amber-500" />
                <p className="font-semibold text-gray-900 dark:text-white">Tip sent to @{toHandle}!</p>
                <button onClick={() => { setOpen(false); setDone(false); }}
                  className="mt-4 text-sm text-brand hover:underline">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Tip @{toHandle}</h3>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_AMOUNTS.map(a => (
                    <button key={a} onClick={() => setAmount(a)}
                      className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                        amount === a ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}>
                      ₹{a}
                    </button>
                  ))}
                </div>
                <input value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Add a message (optional)" maxLength={280}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand mb-3" />
                <button onClick={handleTip} disabled={sending}
                  className="w-full bg-brand text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 hover:bg-brand-dark transition-colors flex items-center justify-center gap-2">
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Send ₹${amount} tip`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
