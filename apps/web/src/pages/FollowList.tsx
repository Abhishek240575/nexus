import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';

const usersService = {
  getFollowing: (id: string) => api.get(`/api/users/${id}/following`),
  getFollowers: (id: string) => api.get(`/api/users/${id}/followers`),
  getProfile:   (handle: string) => api.get(`/api/users/${handle}`),
  follow:       (id: string) => api.post(`/api/users/${id}/follow`),
};

function UserRow({ user, currentUserId }: { user: any; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(user.is_following ?? false);

  const followMutation = useMutation({
    mutationFn: () => usersService.follow(user.id),
    onSuccess: (res: any) => {
      setIsFollowing(res.data?.data?.following ?? !isFollowing);
    },
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
      <Link to={`/${user.handle}`} className="flex-shrink-0">
        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=44`}
          className="w-11 h-11 rounded-full object-cover" alt={user.handle} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/${user.handle}`} className="flex items-center gap-1 hover:underline">
          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {user.display_name || user.handle}
          </span>
          {user.verified && <span className="text-brand text-xs">✓</span>}
        </Link>
        <p className="text-xs text-gray-500">@{user.handle}</p>
        {user.bio && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">{user.bio}</p>}
      </div>
      {currentUserId && user.id !== currentUserId && (
        <button onClick={() => followMutation.mutate()}
          disabled={followMutation.isPending}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-colors ${
            isFollowing
              ? 'border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:border-red-300 hover:text-red-500'
              : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90'
          }`}>
          {followMutation.isPending ? '…' : isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export default function FollowList() {
  const { handle } = useParams<{ handle: string }>();
  const location = useLocation();
  const type = location.pathname.endsWith('/followers') ? 'followers' : 'following';
  const { user } = useAuthStore();

  const { data: profileData } = useQuery({
    queryKey: ['profile', handle],
    queryFn:  () => usersService.getProfile(handle!),
  });

  const profile   = profileData?.data?.data;
  const profileId = profile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['follow-list', handle, type],
    queryFn:  () => type === 'following'
      ? usersService.getFollowing(profileId!)
      : usersService.getFollowers(profileId!),
    enabled: !!profileId && !!type,
  });
  const users = data?.data?.data?.data ?? [];
  const title   = type === 'following' ? 'Following' : 'Followers';

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to={`/${handle}`} className="text-gray-700 dark:text-gray-300 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">{profile?.display_name || handle}</h1>
            <p className="text-xs text-gray-500">@{handle}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-2">
          <Link to={`/${handle}/following`}
            className={`flex-1 text-center py-2 text-sm font-medium border-b-2 transition-colors ${
              type === 'following' ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
            }`}>
            Following {profile ? profile.following_count : ''}
          </Link>
          <Link to={`/${handle}/followers`}
            className={`flex-1 text-center py-2 text-sm font-medium border-b-2 transition-colors ${
              type === 'followers' ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'
            }`}>
            Followers {profile ? profile.followers_count : ''}
          </Link>
        </div>
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand" />
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium">{type === 'following' ? `@${handle} isn't following anyone yet` : `@${handle} has no followers yet`}</p>
        </div>
      )}

      {users.map((u: any) => (
        <UserRow key={u.id} user={u} currentUserId={user?.id} />
      ))}
    </div>
  );
}
