import { useState, useEffect, useCallback } from 'react';
import { useParams, Link }  from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LiveKitRoom, useParticipants, useLocalParticipant,
  useTracks, AudioTrack, RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Radio, Mic, MicOff, PhoneOff, Hand, Users, Plus, Loader2, Clock } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';

const spacesService = {
  getAll:       ()         => api.get('/api/spaces'),
  getOne:       (id: string) => api.get(`/api/spaces/${id}`),
  getParticipants: (id: string) => api.get(`/api/spaces/${id}/participants`),
  create:       (data: any) => api.post('/api/spaces', data),
  join:         (id: string) => api.post(`/api/spaces/${id}/join`),
  leave:        (id: string) => api.post(`/api/spaces/${id}/leave`),
  end:          (id: string) => api.post(`/api/spaces/${id}/end`),
  raiseHand:    (id: string, raised: boolean) => api.post(`/api/spaces/${id}/raise-hand`, { raised }),
  promote:      (id: string, userId: string) => api.post(`/api/spaces/${id}/promote/${userId}`),
};

// ─── In-Room UI ───────────────────────────────────────────────────────────────
function SpaceRoom({ space, token, role, onLeave }: {
  space: any; token: string; role: string; onLeave: () => void;
}) {
  const { user }       = useAuthStore();
  const [muted, setMuted] = useState(role === 'listener');
  const [handRaised, setHandRaised] = useState(false);
  const livekitUrl     = import.meta.env.VITE_LIVEKIT_URL;
  const queryClient    = useQueryClient();

  const leaveMutation = useMutation({
    mutationFn: () => spacesService.leave(space.id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['spaces'] }); onLeave(); },
  });

  const endMutation = useMutation({
    mutationFn: () => spacesService.end(space.id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['spaces'] }); onLeave(); },
  });

  const handMutation = useMutation({
    mutationFn: (raised: boolean) => spacesService.raiseHand(space.id, raised),
    onSuccess:  (_: any, raised: boolean) => setHandRaised(raised),
  });

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect={true}
      audio={role !== 'listener'}
      video={false}
      onDisconnected={onLeave}
    >
      <RoomAudioRenderer />
      <div className="flex flex-col h-screen max-h-screen bg-gray-950">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />LIVE
            </span>
            <span className="text-xs text-gray-400 capitalize">{space.category}</span>
          </div>
          <h1 className="text-lg font-bold text-white leading-snug">{space.title}</h1>
        </div>

        {/* Participants grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ParticipantGrid spaceId={space.id} hostId={space.host_id} myRole={role} />
        </div>

        {/* Controls */}
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex items-center justify-center gap-4">
            {role !== 'listener' && (
              <button
                onClick={() => setMuted(m => !m)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  muted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-white'
                }`}>
                {muted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
            )}

            {role === 'listener' && (
              <button
                onClick={() => handMutation.mutate(!handRaised)}
                disabled={handMutation.isPending}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  handRaised ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-300'
                }`}>
                <Hand size={22} />
              </button>
            )}

            {role === 'host' ? (
              <button
                onClick={() => endMutation.mutate()}
                disabled={endMutation.isPending}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
                <PhoneOff size={22} />
              </button>
            ) : (
              <button
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
                <PhoneOff size={22} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            {role === 'host' ? 'You are the host' : role === 'speaker' ? 'You are a speaker' : 'You are listening'}
            {handRaised && ' · Hand raised ✋'}
          </p>
        </div>
      </div>
    </LiveKitRoom>
  );
}

function ParticipantGrid({ spaceId, hostId, myRole }: { spaceId: string; hostId: string; myRole: string }) {
  const { data } = useQuery({
    queryKey:      ['space-participants', spaceId],
    queryFn:       () => spacesService.getParticipants(spaceId),
    refetchInterval: 5000,
  });
  const queryClient = useQueryClient();
  const participants = data?.data?.data ?? [];
  const speakers    = participants.filter((p: any) => p.role !== 'listener');
  const listeners   = participants.filter((p: any) => p.role === 'listener');
  const handRaisers = listeners.filter((p: any) => p.hand_raised);

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => spacesService.promote(spaceId, userId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['space-participants', spaceId] }),
  });

  return (
    <div>
      {/* Speakers */}
      <p className="text-xs text-gray-500 mb-3">Speakers · {speakers.length}</p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {speakers.map((p: any) => (
          <div key={p.user_id} className="flex flex-col items-center gap-2">
            <div className={`relative w-16 h-16 rounded-full border-2 ${p.role === 'host' ? 'border-brand' : 'border-green-500'}`}>
              <img
                src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.handle}&background=1d9bf0&color=fff&size=64`}
                className="w-full h-full rounded-full object-cover"
                alt={p.handle}
              />
              {p.is_muted && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <MicOff size={10} className="text-white" />
                </div>
              )}
            </div>
            <p className="text-xs text-white text-center truncate w-full">{p.display_name || p.handle}</p>
            {p.role === 'host' && <span className="text-xs text-brand">Host</span>}
          </div>
        ))}
      </div>

      {/* Hand raisers */}
      {handRaisers.length > 0 && myRole === 'host' && (
        <div className="mb-4">
          <p className="text-xs text-yellow-400 mb-2">✋ Raised hands · {handRaisers.length}</p>
          {handRaisers.map((p: any) => (
            <div key={p.user_id} className="flex items-center justify-between py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.handle}&background=1d9bf0&color=fff&size=32`}
                  className="w-8 h-8 rounded-full" alt={p.handle} />
                <span className="text-sm text-white">{p.display_name || p.handle}</span>
              </div>
              <button onClick={() => promoteMutation.mutate(p.user_id)}
                className="text-xs bg-brand text-white px-3 py-1 rounded-full hover:bg-brand-dark transition-colors">
                Invite to speak
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Listeners */}
      <p className="text-xs text-gray-500 mb-3">Listeners · {listeners.length}</p>
      <div className="flex flex-wrap gap-2">
        {listeners.map((p: any) => (
          <div key={p.user_id} className="flex flex-col items-center gap-1">
            <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.handle}&background=374151&color=fff&size=36`}
              className="w-9 h-9 rounded-full opacity-70" alt={p.handle} />
            <p className="text-xs text-gray-500 truncate w-9 text-center">{p.handle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Space Detail (join page) ─────────────────────────────────────────────────
function SpaceDetail({ id }: { id: string }) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [myRole, setMyRole]       = useState<string>('listener');
  const [inRoom, setInRoom]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['space', id],
    queryFn:  () => spacesService.getOne(id),
  });

  const joinMutation = useMutation({
    mutationFn: () => spacesService.join(id),
    onSuccess:  (res: any) => {
      setRoomToken(res.data.data.token);
      setMyRole(res.data.data.role);
      setInRoom(true);
    },
  });

  const space = data?.data?.data;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>;
  if (!space)   return <div className="text-center py-12 text-gray-400">Space not found</div>;

  if (inRoom && roomToken) {
    return <SpaceRoom space={space} token={roomToken} role={myRole} onLeave={() => {
      setInRoom(false);
      setRoomToken(null);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    }} />;
  }

  return (
    <div className="px-4 py-6 max-w-sm mx-auto text-center">
      <Link to="/spaces" className="text-brand text-sm hover:underline mb-6 block text-left">← All Spaces</Link>
      <div className="w-20 h-20 rounded-full bg-brand mx-auto flex items-center justify-center mb-4">
        <img src={space.host_avatar || `https://ui-avatars.com/api/?name=${space.host_handle}&background=1d9bf0&color=fff&size=80`}
          className="w-full h-full rounded-full object-cover" alt={space.host_handle} />
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />LIVE
        </span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{space.title}</h1>
      <p className="text-sm text-gray-500 mb-1">Hosted by @{space.host_handle}</p>
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mb-6">
        <span className="flex items-center gap-1"><Users size={12} />{space.listener_count} listening</span>
        <span className="flex items-center gap-1"><Mic size={12} />{space.speaker_count} speakers</span>
      </div>
      {space.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{space.description}</p>}
      {user ? (
        <button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50">
          {joinMutation.isPending ? 'Joining…' : 'Join Space'}
        </button>
      ) : (
        <p className="text-sm text-gray-500">Sign in to join this Space</p>
      )}
    </div>
  );
}

// ─── Main Spaces page ─────────────────────────────────────────────────────────
export default function Spaces() {
  const { id }      = useParams<{ id?: string }>();
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general' });
  const [roomToken, setRoomToken]   = useState<string | null>(null);
  const [activeSpace, setActiveSpace] = useState<any>(null);
  const [myRole, setMyRole]           = useState('host');

  const { data, isLoading } = useQuery({
    queryKey:        ['spaces'],
    queryFn:         () => spacesService.getAll(),
    refetchInterval: 15000,
    enabled:         !id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => spacesService.create(data),
    onSuccess:  (res: any) => {
    console.log('[Spaces] Create response:', res.data);
    const data = res.data?.data || res.data;
    const token = data.token;
    const { token: _t, livekit_url: _l, ...space } = data;
    console.log('[Spaces] Token:', token, 'Space:', space);
    if (!token) {
      console.error('[Spaces] No token received!');
      return;
    }
    setRoomToken(token);
    setActiveSpace(space);
    setMyRole('host');
    queryClient.invalidateQueries({ queryKey: ['spaces'] });
    setShowCreate(false);
  },
  });

  if (id) return <SpaceDetail id={id} />;

  if (roomToken && activeSpace) {
    return <SpaceRoom space={activeSpace} token={roomToken} role={myRole} onLeave={() => {
      setRoomToken(null);
      setActiveSpace(null);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    }} />;
  }

  const spaces = data?.data?.data ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-brand" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Spaces</h1>
          </div>
          {user && (
            <button onClick={() => setShowCreate(s => !s)}
              className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors">
              <Plus size={14} /> Start Space
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="border-b border-gray-100 dark:border-gray-800 p-4 space-y-3 bg-gray-50 dark:bg-gray-900/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">Start a Space</h2>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="What do you want to talk about?"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
            {['general','politics','social','economy','technology','culture','religion','sports'].map(c => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim() || createMutation.isPending}
              className="bg-brand text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {createMutation.isPending ? 'Starting…' : '🎙️ Go Live'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {spaces.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <Radio size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No live Spaces right now</p>
          <p className="text-sm">Start one and invite people to join!</p>
        </div>
      )}

      {spaces.map((space: any) => (
        <Link key={space.id} to={`/spaces/${space.id}`}
          className="block px-4 py-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
          <div className="flex items-start gap-3">
            <img src={space.host_avatar || `https://ui-avatars.com/api/?name=${space.host_handle}&background=1d9bf0&color=fff&size=44`}
              className="w-11 h-11 rounded-full flex-shrink-0" alt={space.host_handle} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />LIVE
                </span>
                <span className="text-xs text-gray-400 capitalize">{space.category}</span>
              </div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug mb-0.5">{space.title}</p>
              <p className="text-xs text-gray-500 mb-2">@{space.host_handle}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Users size={10} />{space.listener_count} listening</span>
                <span className="flex items-center gap-1"><Mic size={10} />{space.speaker_count} speakers</span>
                <span className="flex items-center gap-1"><Clock size={10} />{formatDistanceToNowStrict(new Date(space.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
