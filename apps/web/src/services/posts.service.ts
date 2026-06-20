import { api } from './api.client';

export const postsService = {
  // Feed
  getHomeFeed:    (cursor?: string) =>
    api.get('/api/posts/feed', { params: { cursor, limit: 20 } }),
  getExploreFeed: (cursor?: string) =>
    api.get('/api/posts/feed/explore', { params: { cursor, limit: 20 } }),

  // CRUD
  createPost: (data: {
    content?: string; media_urls?: string[];
    reply_to_id?: string; quote_of_id?: string;
    community_id?: string; scheduled_at?: string; language?: string;
    language?: string;
  }) => api.post('/api/posts', data),

  getPost:    (id: string) => api.get(`/api/posts/${id}`),
  deletePost: (id: string) => api.delete(`/api/posts/${id}`),
  getReplies: (id: string, cursor?: string) =>
    api.get(`/api/posts/${id}/replies`, { params: { cursor } }),

  // Interactions
  likePost:     (id: string) => api.post(`/api/posts/${id}/like`),
  repostPost:   (id: string) => api.post(`/api/posts/${id}/repost`),
  bookmarkPost: (id: string) => api.post(`/api/posts/${id}/bookmark`),
  getBookmarks: (cursor?: string) =>
    api.get('/api/posts/bookmarks/me', { params: { cursor } }),

  // Hashtags
  getTrending:       () => api.get('/api/posts/hashtags/trending'),
  getPostsByHashtag: (tag: string, cursor?: string) =>
    api.get(`/api/posts/hashtags/${tag}/posts`, { params: { cursor } }),
};

export const usersService = {
  getProfile:  (handle: string) => api.get(`/api/users/${handle}`),
  getUserPosts:(handle: string, tab?: string, cursor?: string) =>
    api.get(`/api/users/${handle}/posts`, { params: { tab, cursor } }),
  followUser:  (id: string)     => api.post(`/api/users/${id}/follow`),
  getFollowers:(id: string)     => api.get(`/api/users/${id}/followers`),
  getFollowing:(id: string)     => api.get(`/api/users/${id}/following`),
  updateProfile:(data: any)     => api.patch('/api/users/me/profile', data),
  search:      (q: string, type?: string) =>
    api.get('/api/users/search', { params: { q, type } }),
};
