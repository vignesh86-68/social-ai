import api from './axios';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  acceptAdminInvitation: (data) => api.post('/auth/admin-invitations/accept', data),
};

// ─── Posts ────────────────────────────────────────────────────────────────────
export const postsAPI = {
  getFeed: (params) => api.get('/posts', { params }),
  getPost: (id) => api.get(`/posts/${id}`),
  createPost: (data) => {
    if (data instanceof FormData) {
      return api.post('/posts', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/posts', data);
  },
  updatePost: (id, data) => api.put(`/posts/${id}`, data),
  deletePost: (id) => api.delete(`/posts/${id}`),
  toggleLike: (id) => api.post(`/posts/${id}/like`),
  toggleBookmark: (id) => api.post(`/posts/${id}/bookmark`),
  getTrendingTags: () => api.get('/posts/trending-tags'),
  searchMentions: (q) => api.get('/posts/mentions/search', { params: { q } }),
  getComments: (id) => api.get(`/posts/${id}/comments`),
  addComment: (id, data) => api.post(`/posts/${id}/comments`, data),
  deleteComment: (postId, commentId) => api.delete(`/posts/${postId}/comments/${commentId}`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: (userId) => api.get(`/users/${userId}`),
  updateProfile: (formData) =>
    api.patch('/users/me/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUserPosts: (userId, params) => api.get(`/users/${userId}/posts`, { params }),
  toggleFollow: (userId) => api.post(`/users/${userId}/follow`),
  getFollowers: (userId, params) => api.get(`/users/${userId}/followers`, { params }),
  getFollowing: (userId, params) => api.get(`/users/${userId}/following`, { params }),
  getFollowStatus: (userId) => api.get(`/users/${userId}/follow-status`),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.patch('/notifications/mark-read', { ids }),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiAPI = {
  contentStudio: (data) => api.post('/ai/content-studio', data),
  summarize: (data) => api.post('/ai/summarize', data),
  suggestReply: (data) => api.post('/ai/suggest-reply', data),
  communityPulse: (data) => api.post('/ai/signal/community-pulse', data),
  audienceInsights: (data) => api.post('/ai/signal/audience-insights', data),
  creatorNextMove: (params) => api.get('/ai/signal/creator-next-move', { params }),
  history: (params) => api.get('/ai/signal/history', { params }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  suspendUser: (id, data) => api.patch(`/admin/users/${id}/suspend`, data),
  reactivateUser: (id) => api.patch(`/admin/users/${id}/reactivate`),
  getAllPosts: (params) => api.get('/admin/posts', { params }),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  deleteComment: (id) => api.delete(`/admin/comments/${id}`),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  createInvitation: (data) => api.post('/admin/invitations', data),
  getInvitations: () => api.get('/admin/invitations'),
  revokeInvitation: (id) => api.delete(`/admin/invitations/${id}`),
};
