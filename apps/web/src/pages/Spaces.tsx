import { Radio, Mic, MicOff, PhoneOff, Users } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export default function Spaces() {
  const { user }         = useAuthStore();
  const [activeSpace, setActiveSpace] = useState<any>(null);
  const [muted, setMuted] = useState(false);

  const mockSpaces = [
    { id: '1', title: 'Building in public — weekly check-in', host: 'priya_v', listeners: 142, speakers: 4, live: true },
    { id: '2', title: 'Startup funding strategies for Indian founders', host: 'rohan_s', listeners: 89, speakers: 3, live: true },
    { id: '3', title: 'PostgreSQL deep dive', host: 'meera_k', listeners: 56, speakers: 2, live: true },
  ];

  if (activeSpace) {
    return (
      <div className="flex flex-col h-screen max-h-screen">
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-4">
              <Radio size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">{activeSpace.title}</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Hosted by @{activeSpace.host}</p>

            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Users size={12} />{activeSpace.listeners} listening
              </div>
            </div>

            {/* Speakers */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {Array.from({ length: activeSpace.speakers }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 ${i === 0 ? 'border-brand bg-brand' : 'border-gray-200 bg-gray-400'}`}>
                    {i === 0 ? activeSpace.host[0].toUpperCase() : 'S'}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate w-full text-center">
                    {i === 0 ? `@${activeSpace.host}` : `Speaker ${i}`}
                  </p>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${i === 0 ? 'bg-brand' : 'bg-gray-200'}`}>
                    <Mic size={10} className={i === 0 ? 'text-white' : 'text-gray-500'} />
                  </div>
                </div>
              ))}
            </div>

            {/* Your listener row */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-400 text-center mb-3">You are listening</p>
              <div className="flex items-center justify-center gap-2">
                <img src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.handle}&background=1d9bf0&color=fff&size=36`}
                  className="w-9 h-9 rounded-full" alt={user?.handle} />
                <p className="text-sm text-gray-700 dark:text-gray-300">@{user?.handle}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 flex items-center justify-center gap-6">
          <button onClick={() => setMuted(m => !m)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button onClick={() => setActiveSpace(null)}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Spaces</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live audio conversations</p>
      </div>

      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <button className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-full transition-colors">
          <Radio size={18} />
          Start a Space
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">LiveKit WebRTC integration — configure LIVEKIT_API_KEY in .env to enable</p>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Live now</p>
        {mockSpaces.map(space => (
          <div key={space.id}
            className="border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
            onClick={() => setActiveSpace(space)}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />LIVE
                  </span>
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug">{space.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">@{space.host}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-white font-bold">
                {space.host[0].toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={12} />{space.listeners} listening</span>
              <span className="flex items-center gap-1"><Mic size={12} />{space.speakers} speakers</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
