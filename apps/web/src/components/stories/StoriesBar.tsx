import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { mediaService } from '@/services/media.service';
import { formatDistanceToNowStrict } from 'date-fns';

const storiesService = {
  getAll:      () => api.get('/api/stories'),
  create:      (data: any) => api.post('/api/stories', data),
  view:        (id: string) => api.post(`/api/stories/${id}/view`),
  getViewers:  (id: string) => api.get(`/api/stories/${id}/viewers`),
  delete:      (id: string) => api.delete(`/api/stories/${id}`),
};

function StoryViewer({ stories, userGroup, onClose, isOwn }: any) {
  const [idx, setIdx] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const queryClient = useQueryClient();
  const story = stories[idx];
  const progress = ((idx + 1) / stories.length) * 100;

  const { data: viewersData } = useQuery({
    queryKey: ['story-viewers', story?.id],
    queryFn:  () => storiesService.getViewers(story.id),
    enabled:  isOwn && showViewers && !!story,
  });

  const deleteMutation = useMutation({
    mutationFn: () => storiesService.delete(story.id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['stories'] }); onClose(); },
  });

  useState(() => {
    if (story) storiesService.view(story.id).catch(() => {});
  });

  const next = () => { if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); };
  const prev = () => { if (idx > 0) setIdx(i => i - 1); };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="relative w-full max-w-sm h-screen max-h-[100vh] bg-gray-900">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
          {stories.map((_: any, i: number) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div className={`h-full bg-white rounded-full ${i < idx ? 'w-full' : i === idx ? 'animate-story-progress' : 'w-0'}`} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-3 z-10">
          <div className="flex items-center gap-2">
            <img src={userGroup.avatar_url || `https://ui-avatars.com/api/?name=${userGroup.handle}&background=1d9bf0&color=fff&size=32`}
              className="w-8 h-8 rounded-full border border-white/50" alt={userGroup.handle} />
            <div>
              <p className="text-white text-xs font-semibold">{userGroup.display_name || userGroup.handle}</p>
              <p className="text-white/60 text-xs">{formatDistanceToNowStrict(new Date(story.created_at), { addSuffix: true })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwn && (
              <button onClick={() => setShowViewers(v => !v)} className="text-white/80 hover:text-white">
                <Eye size={18} />
              </button>
            )}
            {isOwn && (
              <button onClick={() => deleteMutation.mutate()} className="text-white/80 hover:text-red-400">
                <X size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* Story content */}
        <div className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: story.bg_color || '#1d9bf0' }}>
          {story.media_type === 'video' ? (
            <video src={story.media_url} autoPlay muted loop className="w-full h-full object-cover" />
          ) : (
            <img src={story.media_url} className="w-full h-full object-cover" alt="" />
          )}
          {story.caption && (
            <div className="absolute bottom-20 left-0 right-0 px-4">
              <p className="text-white text-sm font-medium text-center bg-black/40 rounded-xl px-3 py-2">
                {story.caption}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10">
          <ChevronLeft size={28} />
        </button>
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10">
          <ChevronRight size={28} />
        </button>

        {/* Viewers panel */}
        {showViewers && isOwn && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 rounded-t-2xl p-4 max-h-48 overflow-y-auto z-20">
            <p className="text-white text-xs font-semibold mb-2">
              {story.view_count} views
            </p>
            {viewersData?.data?.data?.map((v: any) => (
              <div key={v.handle} className="flex items-center gap-2 py-1.5">
                <img src={v.avatar_url || `https://ui-avatars.com/api/?name=${v.handle}&background=1d9bf0&color=fff&size=24`}
                  className="w-6 h-6 rounded-full" alt={v.handle} />
                <span className="text-white/80 text-xs">@{v.handle}</span>
                <span className="text-white/40 text-xs ml-auto">
                  {formatDistanceToNowStrict(new Date(v.viewed_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoriesBar() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ group: any; stories: any[] } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['stories'], queryFn: storiesService.getAll });
  const groups: any[] = data?.data?.data || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { public_url } = await mediaService.uploadMedia(file);
      await storiesService.create({
        media_url:  public_url,
        media_type: file.type.startsWith('video') ? 'video' : 'image',
      });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    } catch { /* silent */ } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) return null;
  if (!user && !groups.length) return null;

  return (
    <>
      {viewing && (
        <StoryViewer
          stories={viewing.stories}
          userGroup={viewing.group}
          onClose={() => setViewing(null)}
          isOwn={viewing.group.user_id === user?.id}
        />
      )}

      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-gray-100 dark:border-gray-800">
        {/* Add story button */}
        {user && (
          <div className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
            <div className={`w-14 h-14 rounded-full border-2 border-dashed border-brand flex items-center justify-center bg-brand/5 ${uploading ? 'opacity-50' : 'hover:bg-brand/10'} transition-colors`}>
              {uploading ? (
                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={20} className="text-brand" />
              )}
            </div>
            <span className="text-xs text-gray-500 text-center w-14 truncate">Your story</span>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
          </div>
        )}

        {/* Story groups */}
        {groups.map(group => {
          const hasUnseen = group.has_unseen;
          return (
            <div key={group.user_id} className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
              onClick={() => setViewing({ group, stories: group.stories })}>
              <div className={`w-14 h-14 rounded-full p-0.5 ${hasUnseen ? 'bg-gradient-to-tr from-brand via-purple-500 to-pink-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <img src={group.avatar_url || `https://ui-avatars.com/api/?name=${group.handle}&background=1d9bf0&color=fff&size=56`}
                  className="w-full h-full rounded-full object-cover border-2 border-white dark:border-black"
                  alt={group.handle} />
              </div>
              <span className="text-xs text-gray-700 dark:text-gray-300 text-center w-14 truncate">
                {group.display_name || group.handle}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
