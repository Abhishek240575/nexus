import { BadgeCheck } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  plus:       'text-brand',
  pro:        'text-amber-500',
  enterprise: 'text-purple-500',
};

export default function VerifiedBadge({ tier, size = 14 }: { tier?: string; size?: number }) {
  if (!tier || tier === 'free') return null;
  const color = TIER_COLORS[tier] || 'text-brand';
  return <BadgeCheck size={size} className={color} fill="currentColor" stroke="white" strokeWidth={1.5} />;
}
