import rateLimit from 'express-rate-limit';

const options = (max: number, windowMinutes: number, message: string) =>
  rateLimit({
    windowMs:        windowMinutes * 60 * 1000,
    max,
    message:         { success: false, error: message },
    standardHeaders: true,
    legacyHeaders:   false,
  });

export const globalLimiter = options(
  500, 15,
  'Too many requests, please slow down'
);

export const authLimiter = options(
  10, 15,
  'Too many auth attempts, please try again in 15 minutes'
);

export const postLimiter = options(
  50, 60,
  'Posting too fast, please wait a moment'
);

export const uploadLimiter = options(
  20, 60,
  'Too many uploads, please wait a moment'
);

export const searchLimiter = options(
  60, 1,
  'Too many search requests'
);
