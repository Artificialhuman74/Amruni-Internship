import { api } from './api';

export const communityApi = {
  getTags: async () => (await api.get('/community/tags')).data,

  // { posts, nextBefore } — nextBefore is the createdAt cursor for the next
  // page, or null when the feed is exhausted. Pass it back as `before`.
  getFeed: async ({ tag, before, limit } = {}) =>
    (await api.get('/community/feed', { params: { tag, before, limit } })).data,

  // { post, replies } — replies are flat (X-style), reverse-chronological.
  getPost: async (id) => (await api.get(`/community/posts/${id}`)).data,

  createPost: async ({ tags, type, text, pollOptions, isAnonymous, replyToId }) =>
    (await api.post('/community/posts', { tags, type, text, pollOptions, isAnonymous, replyToId })).data,

  toggleLike: async (id) => (await api.post(`/community/posts/${id}/like`)).data,

  vote: async (id, optionIndex) => (await api.post(`/community/posts/${id}/vote`, { optionIndex })).data,

  report: async (id, reason) => (await api.post(`/community/posts/${id}/report`, { reason })).data,

  blockAuthor: async (id) => (await api.post(`/community/posts/${id}/block-author`)).data,
};
