import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  lazyConnect:          true,
});

redis.on('connect',  () => console.log('[Redis] Connected'));
redis.on('error',    (err) => console.error('[Redis] Error', err));

export const CACHE_TTL = {
  FEED:          300,   // 5 min
  PROFILE:       600,   // 10 min
  TRENDING:      180,   // 3 min
  POST:          120,   // 2 min
  SESSION:       604800 // 7 days
};
