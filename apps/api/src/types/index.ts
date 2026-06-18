import { Request } from 'express';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub:          string;   // user id
  handle:       string;
  premium_tier: string;
  jti:          string;   // token id for blacklisting
  iat?:         number;
  exp?:         number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id:           string;
    handle:       string;
    email:        string;
    verified:     boolean;
    premium_tier: string;
    suspended:    boolean;
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────
export interface User {
  id:              string;
  handle:          string;
  email:           string;
  display_name:    string | null;
  bio:             string | null;
  avatar_url:      string | null;
  header_url:      string | null;
  location:        string | null;
  website:         string | null;
  verified:        boolean;
  premium_tier:    'free' | 'plus' | 'pro' | 'enterprise';
  followers_count: number;
  following_count: number;
  posts_count:     number;
  suspended:       boolean;
  email_verified:  boolean;
  created_at:      Date;
  updated_at:      Date;
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export interface Post {
  id:             string;
  user_id:        string;
  content:        string | null;
  media_urls:     string[];
  reply_to_id:    string | null;
  quote_of_id:    string | null;
  community_id:   string | null;
  scheduled_at:   Date | null;
  is_published:   boolean;
  likes_count:    number;
  reposts_count:  number;
  replies_count:  number;
  quotes_count:   number;
  views_count:    number;
  created_at:     Date;
  updated_at:     Date;
}

export interface FeedPost extends Post {
  author_handle:  string;
  author_name:    string | null;
  author_avatar:  string | null;
  author_verified: boolean;
  author_tier:    string;
  is_liked?:      boolean;
  is_reposted?:   boolean;
  is_bookmarked?: boolean;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationQuery {
  limit?:  string;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data:        T[];
  next_cursor: string | null;
  has_more:    boolean;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
  message?: string;
}
