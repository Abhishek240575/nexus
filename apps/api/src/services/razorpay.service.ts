import Razorpay from 'razorpay';
import crypto   from 'crypto';

// Use placeholder if env vars not set Ã¢â‚¬â€ prevents startup crash
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key',
});

export const TIER_PLAN_IDS: Record<string, string | undefined> = {
  plus:       process.env.RAZORPAY_PLAN_PLUS,
  pro:        process.env.RAZORPAY_PLAN_PRO,
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
};

export const createOrder = async (amountPaise: number, receipt: string, notes?: any) => {
  return razorpay.orders.create({
    amount:   amountPaise,
    currency: 'INR',
    receipt:  receipt.slice(0, 40),
    notes:    notes || {},
  });
};

export const createSubscription = async (planId: string, customerId?: string, totalCount: number = 12) => {
  return (razorpay.subscriptions as any).create({
    plan_id:     planId,
    total_count: totalCount,
    quantity:    1,
  });
};

export const cancelSubscription = async (subscriptionId: string, cancelAtPeriodEnd?: boolean) => {
  return (razorpay.subscriptions as any).cancel(subscriptionId);
};

export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string): boolean => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key')
    .update(body).digest('hex');
  return expected === signature;
};

export const verifySubscriptionSignature = (subscriptionId: string, paymentId: string, signature: string): boolean => {
  const body = `${paymentId}|${subscriptionId}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key')
    .update(body).digest('hex');
  return expected === signature;
};

export default razorpay;

export const createCustomer = async (name: string, email: string, _extra?: any) => {
  return (razorpay.customers as any).create({ name, email });
};

export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
};
