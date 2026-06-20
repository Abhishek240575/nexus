import { useState }        from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Link2, MapPin, Loader2, X } from 'lucide-react';
import { usersService }    from '@/services/posts.service';
import { useAuthStore }    from '@/stores/auth.store';
import Feed                from '@/components/feed/Feed';
import VerifiedBadge          from '@/components/common/VerifiedBadge';
import UserBadges             from '@/components/common/UserBadges';
import CreatorSubscribeButton from '@/components/common/CreatorSubscribeButton';
import { format }          from 'date-fns';
import { api }             from '@/services/api.client';

export default function Profile() {
  const { handle }     = useParams<{ handle: string }>();
  const { user }       = useAuthStore();
  const queryClient    = useQueryClient();
  const [tab, setTab]  = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [showEdit,     setShowEdit]     = useState(false);
  const [editName,     setEditName]     = useState('');
  const [editBio,      setEditBio]      = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite,  setEditWebsite]  = useState('');
  const [editSaving,   setEditSaving]   = useState(false);
  const [editError,    setEditError]    = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['profile', handle],
    queryFn:  () => usersService.getProfile(handle!),
    enabled:  !!handle,
  });
  const profile = data?.data?.data;

  const followMutation = useMutation({
    mutationFn: () => usersService.followUser(profile.id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['profile', handle] }),
  });

  const openEdit = () => {
    setEditName(profile.display_name || '');
    setEditBio(profile.bio || '');
    setEditLocation(profile.location || '');
    setEditWebsite(profile.website || '');
    setEditError('');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      await api.patch('/api/users/me/profile', {
        display_name: editName,
        bio:          editBio,
        location:     editLocation,
        website:      editWebsite,
      });
      queryClient.invalidateQueries({ queryKey: ['profile', handle] });
      setShowEdit(false);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Could not save. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;
  if (!profile)  return <div className="text-center py-12 text-gray-400">User not found</div>;

  const isMe       = user?.handle === handle;
  const avatarUrl  = profile.avatar_url  || `https://ui-avatars.com/api/?name=${profile.handle}&background=1d9bf0&color=fff&size=80`;
  const headerUrl  = profile.header_url;

  return (
    <div>
      {/* Header image */}
      <div className="h-32 bg-gradient-to-r from-brand to-blue-400 relative">
        {headerUrl && <img src={headerUrl} alt="" className="w-full h-full object-cover" />}
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <img src={avatarUrl} alt={profile.handle}
            className="w-20 h-20 rounded-full border-4 border-white dark:border-black object-cover" />
          <div>
            {isMe ? (
              <button onClick={openEdit} className="border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-semibold px-4 py-1.5 rounded-full text-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                Edit profile
              </button>
            ) : (
              <button
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className={`font-semibold px-4 py-1.5 rounded-full text-sm transition-colors ${
                  profile.is_following
                    ? 'border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:border-red-300 hover:text-red-500'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-200'
                }`}>
                {followMutation.isPending ? '…' : profile.is_following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{profile.display_name || profile.handle}</h1>
            {profile.verified && <VerifiedBadge tier={profile.premium_tier} size={16} />}
            {profile.is_journalist && (
              <span title="Verified journalist" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-medium">Press</span>
            )}
          </div>
          <p className="text-gray-500">@{profile.handle}</p>
        </div>

        {profile.bio && <p className="text-gray-900 dark:text-white text-sm mb-3 leading-relaxed">{profile.bio}</p>}

        <UserBadges handle={profile.handle} />
        <CreatorSubscribeButton handle={profile.handle} />

        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 mt-2 text-sm text-gray-500">
          {profile.location && <span className="flex items-center gap-1"><MapPin size={14} />{profile.location}</span>}
          {profile.website  && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand hover:underline"><Link2 size={14} />{profile.website}</a>}
          {profile.press_credential_url && (
            <a href={profile.press_credential_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline text-sm">
              <span className="text-xs font-medium">Press credential</span>
            </a>
          )}
          <span className="flex items-center gap-1"><Calendar size={14} />Joined {format(new Date(profile.created_at), 'MMMM yyyy')}</span>
        </div>

        <div className="flex gap-4 text-sm">
          <Link to={`/${handle}/following`} className="hover:underline">
            <span className="font-semibold text-gray-900 dark:text-white">{profile.following_count.toLocaleString()}</span>
            <span className="text-gray-500 ml-1">Following</span>
          </Link>
          <Link to={`/${handle}/followers`} className="hover:underline">
            <span className="font-semibold text-gray-900 dark:text-white">{profile.followers_count.toLocaleString()}</span>
            <span className="text-gray-500 ml-1">Followers</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {(['posts', 'replies', 'media', 'likes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-4 text-sm font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-brand text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <Feed type="profile" handle={handle} tab={tab} />

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-black rounded-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <button onClick={() => setShowEdit(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900">
                <X size={18} className="text-gray-700 dark:text-gray-300" />
              </button>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit profile</h2>
              <button onClick={saveEdit} disabled={editSaving}
                className="bg-gray-900 dark:bg-white text-white dark:text-black font-semibold px-4 py-1.5 rounded-full text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* Fields */}
            <div className="px-4 py-4 space-y-4">
              {editError && <p className="text-red-500 text-sm">{editError}</p>}

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={50}
                  placeholder="Your name"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} maxLength={160} rows={3}
                  placeholder="Tell the world about yourself"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors resize-none" />
                <p className="text-xs text-gray-400 text-right mt-0.5">{editBio.length}/160</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Location</label>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)} maxLength={30}
                  placeholder="Where are you based?"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Website</label>
                <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} maxLength={100}
                  placeholder="https://yourwebsite.com"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand transition-colors" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
