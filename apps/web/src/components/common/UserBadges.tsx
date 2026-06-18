import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api.client';

const badgesService = {
  get: (handle: string) => api.get(`/api/monetization/badges/${handle}`),
};

export default function UserBadges({ handle }: { handle: string }) {
  const { data } = useQuery({ queryKey: ['badges', handle], queryFn: () => badgesService.get(handle) });
  const badges = data?.data?.data ?? [];

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {badges.map((b: any) => (
        <div key={`${b.badge_id}-${b.awarded_at}`} title={b.description}
          className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-medium">
          <span>{b.icon}</span>
          <span>{b.display_name}</span>
        </div>
      ))}
    </div>
  );
}