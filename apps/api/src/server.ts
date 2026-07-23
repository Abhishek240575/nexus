process.on('uncaughtException', (err) => { console.error('[Server] Uncaught exception:', err.message); });
process.on('unhandledRejection', (err) => { console.error('[Server] Unhandled rejection:', err); });

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

export const io = new Server(httpServer, {
  cors: {
    origin:      (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173').split(','),
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

registerSocketHandlers(io);

const start = async (): Promise<void> => {
  await connectDB();

  // Redis is optional - server starts even if Redis is unavailable
  try {
    await redis.connect();
    console.log('[Redis] Connected');
  } catch (err: any) {
    console.error('[Redis] Failed to connect (non-fatal):', err.message);
    console.log('[Redis] Continuing without Redis...');
  }

  httpServer.listen(PORT, () => {
    console.log(`[Nexus API] Running on http://localhost:${PORT}`);
    console.log(`[Nexus API] Environment: ${process.env.NODE_ENV}`);
  });

  setTimeout(async () => {
    try {
      await recordHashtagVelocitySnapshot();
      console.log('[VelocityCron] Initial snapshot complete');
    } catch (err: any) {
      console.error('[VelocityCron] Initial snapshot failed:', err.message);
    }
  }, 30000);

  setInterval(async () => {
    try {
      await recordHashtagVelocitySnapshot();
    } catch (err: any) {
      console.error('[VelocityCron] Hourly snapshot failed:', err.message);
    }
  }, 60 * 60 * 1000);
};

start().catch((err) => {
  console.error('[Nexus API] Failed to start:', err);
  process.exit(1);
});
