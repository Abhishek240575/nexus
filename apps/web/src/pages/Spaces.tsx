import { useState, useEffect, useCallback } from 'react';
import { useParams, Link }  from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LiveKitRoom, useParticipants, useLocalParticipant,
  useTracks, AudioTrack, RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Radio, Mic, MicOff, PhoneOff, Hand, Users, Plus, Loader2, Clock, Crown, Ticket } from 'lucide-react';
import { api } from '@/services/api.client';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNowStrict } from 'date-fns';

const spacesService = {
  getAll:          ()           => api.get('/api/spaces'),
  getOne:          (id: string) => api.get(`/api/spaces/${id}`),
  getParticipants: (id: string) => api.get(`/api/spaces/${id}/participants`),
  create:          (data: any)  => api.post('/api/spaces', data),
  join:            (id: string) => api.post(`/api/spaces/${id}/join`),
  leave:           (id: string) => api.post(`/api/spaces/${id}/leave`),
  end:             (id: string) => api.post(`/api/spaces/${id}/end`),
  raiseHand:       (id: string, raised: boolean) => api.post(`/api/spaces/${id}/raise-hand`, { raised }),
  promote:         (id: string, userId: string)  => api.post(`/api/spaces/${id}/promote/${userId}`),
  startRecording:  (id: string) => api.post(`/api/spaces/${id}/recording/start`),
  stopRecording:   (id: string) => api.post(`/api/spaces/${id}/recording/stop`),
  getRecordings:   ()           => api.get('/api/spaces/recordings'),
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

  const [isRecording, setIsRecording] = useState(!!space.egress_id);
  const recordMutation = useMutation({
    mutationFn: () => isRecording ? spacesService.stopRecording(space.id) : spacesService.startRecording(space.id),
    onSuccess:  () => setIsRecording(r => !r),
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
      onDisconnected={(reason?: any) => {
        console.log('[Spaces] Disconnected:', reason);
        if (reason === 'leave' || reason === 'kicked' || reason === 'room_deleted') {
          onLeave();
        }
        // On network hiccup or token expiry — don't close, LiveKit will reconnect
      }}
      options={{}}
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => recordMutation.mutate()}
                  disabled={recordMutation.isPending}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-colors ${
                    isRecording ? 'bg-red-600 animate-pulse hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  <span className="text-xl">{isRecording ? '⏹' : '⏺'}</span>
                </button>
                <button
                  onClick={() => endMutation.mutate()}
                  disabled={endMutation.isPending}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
                  <PhoneOff size={22} />
                </button>
              </div>
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

function SpaceDetail({ id }: { id: string }) {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [myRole, setMyRole]       = useState<string>('listener');
  const [inRoom, setInRoom]       = useState(false);
  const [joinError, setJoinError] = useState('');
  const [buyingTicket, setBuyingTicket] = useState(false);

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
      setJoinError('');
    },
    onError: (err: any) => {
      setJoinError(err.response?.data?.error || 'Could not join Space');
    },
  });

  const handleBuyTicket = async () => {
    setBuyingTicket(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { alert('Could not load payment gateway.'); setBuyingTicket(false); return; }

      const orderRes = await api.post(`/api/spaces/${id}/ticket/order`);
      const { order_id, amount, key_id } = orderRes.data.data;

      const rzp = new window.Razorpay({
        key: key_id, order_id, amount, currency: 'INR',
        name: 'Deemona', description: `Ticket: ${space?.title}`,
        theme: { color: '#1d9bf0' },
        handler: async (response: any) => {
          await api.post(`/api/spaces/${id}/ticket/confirm`, {
            order_id:   response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature:  response.razorpay_signature,
          });
          setJoinError('');
          joinMutation.mutate();
          setBuyingTicket(false);
        },
        modal: { ondismiss: () => setBuyingTicket(false) },
      });
      rzp.open();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not start ticket purchase');
      setBuyingTicket(false);
    }
  };

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

  const isTicketError = joinError.toLowerCase().includes('ticketed');

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
        {space.is_ticketed && (
          <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-full text-xs font-medium">
            <Ticket size={10} />₹{space.ticket_price_paise / 100}
          </span>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{space.title}</h1>
      <p className="text-sm text-gray-500 mb-1">Hosted by @{space.host_handle}</p>
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mb-6">
        <span className="flex items-center gap-1"><Users size={12} />{space.listener_count} listening</span>
        <span className="flex items-center gap-1"><Mic size={12} />{space.speaker_count} speakers</span>
      </div>
      {space.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{space.description}</p>}

      {joinError && !isTicketError && (
        <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl mb-3">{joinError}</p>
      )}

      {user ? (
        isTicketError ? (
          <button onClick={handleBuyTicket} disabled={buyingTicket}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Ticket size={16} /> {buyingTicket ? 'Processing…' : `Buy ticket — ₹${space.ticket_price_paise / 100}`}
          </button>
        ) : (
          <button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50">
            {joinMutation.isPending ? 'Joining…' : 'Join Space'}
          </button>
        )
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
  const [activeTab, setActiveTab]   = useState<'live' | 'recordings'>('live');
  const [form, setForm] = useState({
    title: '', description: '', category: 'general',
    is_ticketed: false, ticket_price_inr: 50, is_recorded: false,
  });
  const [roomToken, setRoomToken]   = useState<string | null>(null);
  const [activeSpace, setActiveSpace] = useState<any>(null);
  const [myRole, setMyRole]           = useState('host');

  const { data, isLoading } = useQuery({
    queryKey:        ['spaces'],
    queryFn:         () => spacesService.getAll(),
    refetchInterval: 15000,
    enabled:         !id,
  });

  const { data: recordingsData, isLoading: recordingsLoading } = useQuery({
    queryKey: ['space-recordings'],
    queryFn:  () => spacesService.getRecordings(),
    enabled:  activeTab === 'recordings' && !id,
  });
  const recordings = recordingsData?.data?.data || [];

  const [createError, setCreateError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => spacesService.create(data),
    onSuccess:  (res: any) => {
      console.log('[Spaces] Create response:', res.data);
      const data = res.data?.data || res.data;
      const token = data.token;
      const { token: _t, livekit_url: _l, ...space } = data;
      if (!token) { console.error('[Spaces] No token received!'); return; }
      setRoomToken(token);
      setActiveSpace(space);
      setMyRole('host');
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setShowCreate(false);
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.error || 'Could not start Space. Please try again.');
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
        <div className="flex gap-4 mt-3">
          {(['live', 'recordings'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`text-sm font-medium pb-1 border-b-2 capitalize transition-colors ${activeTab === t ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-500'}`}>
              {t === 'live' ? 'Live & Upcoming' : 'Recordings'}
            </button>
          ))}
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

          {/* Premium options */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <Crown size={12} className="text-amber-500" /> Premium options
            </p>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300">Record &amp; archive this Space</span>
              <input type="checkbox" checked={form.is_recorded}
                onChange={e => setForm(f => ({ ...f, is_recorded: e.target.checked }))}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300">Ticketed entry</span>
              <input type="checkbox" checked={form.is_ticketed}
                onChange={e => setForm(f => ({ ...f, is_ticketed: e.target.checked }))}
                className="rounded" />
            </label>
            {form.is_ticketed && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">₹</span>
                <input type="number" min={10} value={form.ticket_price_inr}
                  onChange={e => setForm(f => ({ ...f, ticket_price_inr: Number(e.target.value) }))}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
                <span className="text-xs text-gray-400">per listener</span>
              </div>
            )}
            <p className="text-xs text-gray-400">Recording and ticketing require a Pro or Enterprise subscription.</p>
          </div>

          {createError && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{createError}</p>
          )}

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

      {isLoading && activeTab === 'live' && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      {activeTab === 'live' && spaces.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <Radio size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No live Spaces right now</p>
          <p className="text-sm">Start one and invite people to join!</p>
        </div>
      )}

      {activeTab === 'live' && spaces.map((space: any) => (
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
                {space.is_ticketed && (
                  <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-full text-xs font-medium">
                    <Ticket size={10} />₹{space.ticket_price_paise / 100}
                  </span>
                )}
                {space.is_recorded && (
                  <span className="text-xs text-gray-400" title="This Space will be recorded">●REC</span>
                )}
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

      {/* Recordings tab */}
      {activeTab === 'recordings' && (
        <div className="px-4 py-4">
          {recordingsLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>}
          {!recordingsLoading && recordings.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <span className="text-4xl mb-3 block">🎙️</span>
              <p className="font-medium mb-1">No recordings yet</p>
              <p className="text-sm">Start a Space with recording enabled to save it here.</p>
            </div>
          )}
          <div className="space-y-4">
            {recordings.map((rec: any) => (
              <div key={rec.id} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                {/* Video player */}
                <video
                  src={rec.recording_url}
                  controls
                  preload="metadata"
                  className="w-full max-h-64 bg-black"
                />
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{rec.title}</p>
                  <div className="flex items-center gap-2">
                    <img src={rec.host_avatar || `https://ui-avatars.com/api/?name=${rec.host_handle}&background=1d9bf0&color=fff&size=24`}
                      className="w-5 h-5 rounded-full" alt={rec.host_handle} />
                    <span className="text-xs text-gray-500">@{rec.host_handle}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{formatDistanceToNowStrict(new Date(rec.ended_at), { addSuffix: true })}</span>
                    {rec.listener_count > 0 && (
                      <span className="text-xs text-gray-400">· {rec.listener_count} listeners</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
