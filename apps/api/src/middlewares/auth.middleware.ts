import { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import { unauthorized, forbidden } from '../utils/response';
import { AuthenticatedRequest }    from '../types';

// ─── Require authenticated user ───────────────────────────────────────────────
export const protect = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (err || !user) {
      unauthorized(res);
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  })(req, res, next);
};

// ─── Optional auth (attaches user if token present, proceeds either way) ──────
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (_err: any, user: any) => {
    if (user) (req as AuthenticatedRequest).user = user;
    next();
  })(req, res, next);
};

// ─── Require premium tier ─────────────────────────────────────────────────────
export const requirePremium = (tiers: string[] = ['pro', 'creator']) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !tiers.includes(user.premium_tier)) {
      forbidden(res, 'This feature requires a premium subscription');
      return;
    }
    next();
  };

// ─── Require verified email ───────────────────────────────────────────────────
export const requireVerified = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.verified) {
    forbidden(res, 'Please verify your email address');
    return;
  }
  next();
};
