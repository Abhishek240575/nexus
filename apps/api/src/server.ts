import 'dotenv/config';
import http        from 'http';
import { Server }  from 'socket.io';
import app         from './app';
import { connectDB } from './config/db';
import { redis }   from './config/redis';
import { registerSocketHandlers } from './services/socket.service';
import { recordHashtagVelocitySnapshot } from './services/velocity-cron.service';

const PORT = process.env.PORT || 4000;

const httpServer = http.createServer(app);

// ─── Socket.io setup ──────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: {
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

registerSocketHandlers(io);

// ─── Startup ──────────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  await connectDB();
  await redis.connect();

  httpServer.listen(PORT, () => {
    console.log(`[Nexus API] Running on http://localhost:${PORT}`);
    console.log(`[Nexus API] Environment: ${process.env.NODE_ENV}`);
  });

  // ─── Hashtag velocity cron (hourly snapshots for Pro+ extended history) ──────
  // Run once immediately after startup, then every hour
  setTimeout(async () => {
    try {
      await recordHashtagVelocitySnapshot();
      console.log('[VelocityCron] Initial snapshot complete');
    } catch (err: any) {
      console.error('[VelocityCron] Initial snapshot failed:', err.message);
    }
  }, 30000); // 30s after boot to let DB settle

  setInterval(async () => {
    try {
      await recordHashtagVelocitySnapshot();
    } catch (err: any) {
      console.error('[VelocityCron] Hourly snapshot failed:', err.message);
    }
  }, 60 * 60 * 1000); // every 60 minutes
};

start().catch((err) => {
  console.error('[Nexus API] Failed to start:', err);
  process.exit(1);
});
