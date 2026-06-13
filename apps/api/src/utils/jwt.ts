import jwt      from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis, CACHE_TTL } from '../config/redis';
import { JwtPayload }       from '../types';

const JWT_SECRET         = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN     || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ─── Sign access token ────────────────────────────────────────────────────────
export const signAccessToken = (user: {
  id: string; handle: string; premium_tier: string;
}): string => {
  return jwt.sign(
    { sub: user.id, handle: user.handle, premium_tier: user.premium_tier, jti: uuidv4() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

// ─── Sign refresh token ───────────────────────────────────────────────────────
export const signRefreshToken = (userId: string): string => {
  return jwt.sign(
    { sub: userId, jti: uuidv4() },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
};

// ─── Verify access token ──────────────────────────────────────────────────────
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

// ─── Verify refresh token ─────────────────────────────────────────────────────
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
};

// ─── Blacklist a token (logout) ───────────────────────────────────────────────
export const blacklistToken = async (jti: string, expiresIn: number): Promise<void> => {
  await redis.setex(`blacklist:${jti}`, expiresIn, '1');
};

// ─── Store refresh token in Redis ─────────────────────────────────────────────
export const storeRefreshToken = async (userId: string, token: string): Promise<void> => {
  await redis.setex(`refresh:${userId}`, CACHE_TTL.SESSION, token);
};

// ─── Invalidate refresh token ─────────────────────────────────────────────────
export const deleteRefreshToken = async (userId: string): Promise<void> => {
  await redis.del(`refresh:${userId}`);
};

// ─── Get stored refresh token ─────────────────────────────────────────────────
export const getStoredRefreshToken = async (userId: string): Promise<string | null> => {
  return redis.get(`refresh:${userId}`);
};
