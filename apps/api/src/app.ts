import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import compression    from 'compression';
import morgan         from 'morgan';
import cookieParser   from 'cookie-parser';
import passport       from './config/passport';
import { globalLimiter } from './middlewares/rateLimiter.middleware';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes          from './routes/auth.routes';
import postsRoutes         from './routes/posts.routes';
import usersRoutes         from './routes/users.routes';
import notificationsRoutes from './routes/notifications.routes';
import messagesRoutes      from './routes/messages.routes';
import communitiesRoutes   from './routes/communities.routes';
import analyticsRoutes     from './routes/analytics.routes';
import moderationRoutes    from './routes/moderation.routes';
import debatesRoutes       from './routes/debates.routes';
import spacesRoutes        from './routes/spaces.routes';
import narrativeRoutes     from './routes/narrative.routes';
import translationRoutes   from './routes/translation.routes';
import communityModRoutes  from './routes/community-mod.routes';
import listsRoutes         from './routes/lists.routes';

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.use(passport.initialize());

// ─── Rate limit ───────────────────────────────────────────────────────────────
app.use('/api', globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'nexus-api' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/posts',         postsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages',      messagesRoutes);
app.use('/api/communities',   communitiesRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/moderation',    moderationRoutes);
app.use('/api/debates',       debatesRoutes);
app.use('/api/spaces',        spacesRoutes);
app.use('/api/narrative',     narrativeRoutes);
app.use('/api/translate',    translationRoutes);
app.use('/api/communities/:slug/mod', communityModRoutes);
app.use('/api/lists',             listsRoutes);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
