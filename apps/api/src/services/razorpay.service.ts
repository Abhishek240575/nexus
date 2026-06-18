import Razorpay from 'razorpay';
import crypto    from 'crypto';

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// ─── Tier → Razorpay Plan ID mapping ──────────────────────────────────────────
// These plan IDs must be created once in the Razorpay dashboard (Subscriptions > Plans)
// and stored in env vars. Each plan is a recurring monthly charge in INR.
export const TIER_PLAN_IDS: Record<string, string | undefined> = {
  plus:       process.env.RAZORPAY_PLAN_PLUS,
  pro:        process.env.RAZORPAY_PLAN_PRO,
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
};

export interface CreateSubscriptionResult {
  razorpaySubscriptionId: string;
  shortUrl:                string | null;
}

// ─── Create a Razorpay customer (idempotent-ish: caller should store the id) ─
export const createCustomer = async (
  name: string, email: string, contact?: string
): Promise<string> => {
  const customer = await razorpay.customers.create({
    name,
    email,
    contact: contact || undefined,
    fail_existing: 0, // if customer with same email/contact exists, return existing
  } as any);
  return customer.id;
};

// ─── Create a recurring subscription for a tier ──────────────────────────────
export const createSubscription = async (
  tierId: string, customerId: string, totalCycles = 120 // ~10 years of monthly cycles
): Promise<CreateSubscriptionResult> => {
  const planId = TIER_PLAN_IDS[tierId];
  if (!planId) throw new Error(`No Razorpay plan configured for tier "${tierId}"`);

  const sub = await razorpay.subscriptions.create({
    plan_id:         planId,
    customer_notify: 1,
    total_count:     totalCycles,
    notes:           { tier: tierId },
  } as any);

  return {
    razorpaySubscriptionId: sub.id,
    shortUrl:                (sub as any).short_url || null,
  };
};

export const cancelSubscription = async (razorpaySubscriptionId: string, cancelAtCycleEnd = true) => {
  return razorpay.subscriptions.cancel(razorpaySubscriptionId, cancelAtCycleEnd);
};

// ─── One-off order (for tips, space tickets, etc.) ────────────────────────────
export const createOrder = async (amountPaise: number, receipt: string, notes: Record<string, string> = {}) => {
  return razorpay.orders.create({
    amount:   amountPaise,
    currency: 'INR',
    receipt,
    notes,
  });
};

// ─── Verify payment signature (for one-off order checkout) ───────────────────
export const verifyPaymentSignature = (
  orderId: string, paymentId: string, signature: string
): boolean => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
};

// ─── Verify webhook signature (for subscription lifecycle events) ────────────
export const verifyWebhookSignature = (
  body: string, signature: string
): boolean => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');
  return expected === signature;
};

export default razorpay;
