import StoriesBar from '@/components/stories/StoriesBar';
import { useState }    from 'react';
import PostComposer    from '@/components/post/PostComposer';
import Feed            from '@/components/feed/Feed';

export default function Home() {
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you');

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10">
        <div className="flex">
          {(['for-you', 'following'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? 'border-brand text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t === 'for-you' ? 'For you' : 'Following'}
            </button>
          ))}
        </div>
      </div>
      <PostComposer placeholder="What's happening?" />
      <StoriesBar />
      <Feed type={tab === 'for-you' ? 'explore' : 'home'} />
    </div>
  );
}
