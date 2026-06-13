import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';

interface SocketUser {
  userId: string;
  handle: string;
}

// Track online users: userId → socketId
const onlineUsers = new Map<string, string>();

export const registerSocketHandlers = (io: Server): void => {

  // ─── Auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      (socket as any).user = { userId: payload.sub, handle: payload.handle };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, handle } = (socket as any).user as SocketUser;

    // Join personal room for targeted events
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, socket.id);

    console.log(`[Socket] @${handle} connected (${socket.id})`);

    // ─── DM rooms ──────────────────────────────────────────────────────────
    socket.on('dm:join', (conversationId: string) => {
      socket.join(`dm:${conversationId}`);
    });

    socket.on('dm:leave', (conversationId: string) => {
      socket.leave(`dm:${conversationId}`);
    });

    socket.on('dm:typing', (conversationId: string) => {
      socket.to(`dm:${conversationId}`).emit('dm:typing', { userId, handle });
    });

    socket.on('dm:stop_typing', (conversationId: string) => {
      socket.to(`dm:${conversationId}`).emit('dm:stop_typing', { userId });
    });

    // ─── Space rooms ───────────────────────────────────────────────────────
    socket.on('space:join', (spaceId: string) => {
      socket.join(`space:${spaceId}`);
      io.to(`space:${spaceId}`).emit('space:participant_joined', { userId, handle });
    });

    socket.on('space:leave', (spaceId: string) => {
      socket.leave(`space:${spaceId}`);
      io.to(`space:${spaceId}`).emit('space:participant_left', { userId });
    });

    // ─── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      console.log(`[Socket] @${handle} disconnected`);
    });
  });
};

// ─── Emit helpers (called from controllers) ───────────────────────────────────
export const emitNotification = (io: Server, userId: string, notification: object): void => {
  io.to(`user:${userId}`).emit('notification:new', notification);
};

export const emitNewMessage = (io: Server, conversationId: string, message: object): void => {
  io.to(`dm:${conversationId}`).emit('dm:new_message', message);
};

export const emitNewPost = (io: Server, post: object): void => {
  io.emit('feed:new_post', post);
};

export const isUserOnline = (userId: string): boolean =>
  onlineUsers.has(userId);
