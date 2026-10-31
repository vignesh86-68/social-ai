import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  Heart,
  Bookmark,
  Share2,
  Trash2,
  Edit3,
  Send,
  Bot,
  RefreshCw,
  Image as ImageIcon,
  X,
  TrendingUp,
  Compass,
  Clock,
  Users,
  Hash,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { postsAPI, aiAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Link, useSearchParams } from 'react-router-dom';

export default function Feed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab & Filter States
  const activeTab = searchParams.get('tab') || 'for-you';
  const activeTag = searchParams.get('tag') || '';
  const searchQuery = searchParams.get('search') || '';

  // Feed Data States
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Trending Sidebar
  const [trendingTags, setTrendingTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Composer States
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]); // [{ file, previewUrl }]
  const fileInputRef = useRef(null);

  // AI Assistant in Composer
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiTone, setAiTone] = useState('engaging');

  // Mention Autocomplete
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const textareaRef = useRef(null);

  // Post Actions States
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [copiedPostId, setCopiedPostId] = useState(null);

  // Intersection Observer for Infinite Scroll
  const loadMoreRef = useRef(null);

  // ─── Fetch Feed Posts ────────────────────────────────────────────────────────
  const fetchFeed = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        const params = {
          tab: activeTab,
          page: pageNum,
          limit: 10,
        };
        if (activeTag) params.tag = activeTag;
        if (searchQuery) params.search = searchQuery;

        const res = await postsAPI.getFeed(params);
        const newPosts = res.data.data.posts || [];
        const pagination = res.data.data.pagination || {};

        setPosts((prev) => {
          if (!append) return newPosts;
          const existingIds = new Set(prev.map((p) => p._id));
          const filtered = newPosts.filter((p) => !existingIds.has(p._id));
          return [...prev, ...filtered];
        });

        setHasMore(pageNum < pagination.pages);
        setPage(pageNum);
      } catch (err) {
        console.error('Feed fetch error:', err);
        setError(err.response?.data?.message || 'Failed to load posts feed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, activeTag, searchQuery]
  );

  // Fetch Trending Tags
  const fetchTrendingTags = useCallback(async () => {
    try {
      setLoadingTags(true);
      const res = await postsAPI.getTrendingTags();
      setTrendingTags(res.data.data.tags || []);
    } catch (err) {
      console.warn('Failed to fetch trending tags:', err);
    } finally {
      setLoadingTags(false);
    }
  }, []);

  // Reload feed whenever tab, tag, or search changes
  useEffect(() => {
    setPage(1);
    fetchFeed(1, false);
  }, [fetchFeed]);

  useEffect(() => {
    fetchTrendingTags();
  }, [fetchTrendingTags]);

  // Infinite Scroll Trigger
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchFeed(page + 1, true);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchFeed]);

  // ─── Composer Image Handling ─────────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedImages.length + files.length > 4) {
      toast({ message: 'Maximum 4 images allowed per post', type: 'error' });
      return;
    }

    const validFiles = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ message: `${file.name} exceeds 5 MB limit`, type: 'error' });
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        toast({ message: `${file.name} is not a supported format`, type: 'error' });
        continue;
      }
      validFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setSelectedImages((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setSelectedImages((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  // ─── Composer Mention Detection ──────────────────────────────────────────────
  const handleContentChange = async (e) => {
    const text = e.target.value;
    setContent(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (match) {
      const q = match[1];
      setMentionQuery(q);
      try {
        const res = await postsAPI.searchMentions(q);
        setMentionSuggestions(res.data.data.users || []);
      } catch (err) {
        setMentionSuggestions([]);
      }
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }
  };

  const applyMention = (username) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    const replacedBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);

    setContent(replacedBefore + textAfterCursor);
    setMentionQuery(null);
    setMentionSuggestions([]);
    textareaRef.current.focus();
  };

  // ─── Create Post ─────────────────────────────────────────────────────────────
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && selectedImages.length === 0) return;
    setSubmitting(true);

    try {
      let res;
      if (selectedImages.length > 0) {
        const formData = new FormData();
        formData.append('content', content.trim());
        selectedImages.forEach((img) => formData.append('images', img.file));
        res = await postsAPI.createPost(formData);
      } else {
        res = await postsAPI.createPost({ content: content.trim() });
      }

      const created = res.data.data.post;
      // Prepend post to feed
      setPosts((prev) => [created, ...prev]);

      // Cleanup
      setContent('');
      selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setSelectedImages([]);
      setShowAiHelper(false);
      toast({ message: 'Post published successfully!', type: 'success' });
      fetchTrendingTags();
    } catch (err) {
      toast({
        message: err.response?.data?.message || 'Failed to publish post',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── AI Draft Assistant ──────────────────────────────────────────────────────
  const handleAiDraft = async (action) => {
    if (action === 'generate' && !aiPrompt.trim()) return;
    if (action === 'improve' && !content.trim()) {
      toast({ message: 'Write something in the post field first', type: 'info' });
      return;
    }
    setGeneratingAi(true);
    try {
      const payload = {
        mode: action === 'generate' ? 'generate' : 'improve',
        topic: action === 'generate' ? aiPrompt : undefined,
        currentContent: action === 'improve' ? content : undefined,
        tone: aiTone,
      };
      const res = await aiAPI.contentStudio(payload);
      setContent(res.data.data.result || res.data.data.content);
      toast({ message: 'AI suggestion generated! Review before posting.', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'AI generation failed', type: 'error' });
    } finally {
      setGeneratingAi(false);
    }
  };

  // ─── Post Interactions: Like ─────────────────────────────────────────────────
  const handleLike = async (postId) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === postId) {
          const wasLiked = p.isLikedByMe;
          return {
            ...p,
            isLikedByMe: !wasLiked,
            likesCount: Math.max(0, (p.likesCount || 0) + (wasLiked ? -1 : 1)),
          };
        }
        return p;
      })
    );

    try {
      const res = await postsAPI.toggleLike(postId);
      const { liked, likesCount } = res.data.data;
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, isLikedByMe: liked, likesCount } : p))
      );
    } catch (err) {
      // Rollback on failure
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const wasLiked = p.isLikedByMe;
            return {
              ...p,
              isLikedByMe: !wasLiked,
              likesCount: Math.max(0, (p.likesCount || 0) + (wasLiked ? -1 : 1)),
            };
          }
          return p;
        })
      );
      toast({ message: 'Could not update like', type: 'error' });
    }
  };

  // ─── Post Interactions: Bookmark ─────────────────────────────────────────────
  const handleBookmark = async (postId) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === postId) {
          const wasBookmarked = p.isBookmarkedByMe;
          return {
            ...p,
            isBookmarkedByMe: !wasBookmarked,
            bookmarksCount: Math.max(0, (p.bookmarksCount || 0) + (wasBookmarked ? -1 : 1)),
          };
        }
        return p;
      })
    );

    try {
      const res = await postsAPI.toggleBookmark(postId);
      const { isBookmarked, bookmarksCount } = res.data.data;
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, isBookmarkedByMe: isBookmarked, bookmarksCount } : p
        )
      );
      toast({
        message: isBookmarked ? 'Post saved to bookmarks' : 'Removed from bookmarks',
        type: 'info',
      });
    } catch (err) {
      // Rollback on failure
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const wasBookmarked = p.isBookmarkedByMe;
            return {
              ...p,
              isBookmarkedByMe: !wasBookmarked,
              bookmarksCount: Math.max(0, (p.bookmarksCount || 0) + (wasBookmarked ? -1 : 1)),
            };
          }
          return p;
        })
      );
      toast({ message: 'Could not update bookmark', type: 'error' });
    }
  };

  // ─── Post Interactions: Share ────────────────────────────────────────────────
  const handleShare = async (postId) => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        setCopiedPostId(postId);
        toast({ message: 'Link copied to clipboard!', type: 'success' });
        setTimeout(() => setCopiedPostId(null), 2500);
      } else {
        toast({ message: `Share URL: ${postUrl}`, type: 'info' });
      }
    } catch (err) {
      toast({ message: 'Could not copy link', type: 'error' });
    }
  };

  // ─── Post CRUD: Edit & Delete ────────────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postsAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      toast({ message: 'Post deleted successfully', type: 'info' });
    } catch (err) {
      toast({
        message: err.response?.data?.message || 'Failed to delete post',
        type: 'error',
      });
    }
  };

  const handleStartEdit = (post) => {
    setEditingPostId(post._id);
    setEditContent(post.content);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    try {
      const res = await postsAPI.updatePost(postId, { content: editContent.trim() });
      const updated = res.data.data.post;
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, content: updated.content, hashtags: updated.hashtags, isEdited: true }
            : p
        )
      );
      setEditingPostId(null);
      toast({ message: 'Post updated', type: 'success' });
    } catch (err) {
      toast({ message: 'Failed to update post', type: 'error' });
    }
  };

  // ─── Comments ────────────────────────────────────────────────────────────────
  const handleAddComment = async (postId) => {
    const text = commentText[postId];
    if (!text || !text.trim()) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await postsAPI.addComment(postId, { content: text.trim() });
      const newComment = res.data.data.comment;

      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            return {
              ...p,
              comments: [...(p.comments || []), newComment],
              commentsCount: (p.commentsCount || 0) + 1,
            };
          }
          return p;
        })
      );
      setCommentText((prev) => ({ ...prev, [postId]: '' }));
      toast({ message: 'Comment added', type: 'success' });
    } catch (err) {
      toast({
        message: err.response?.data?.message || 'Failed to add comment',
        type: 'error',
      });
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleToggleComments = async (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }
    setActiveCommentPostId(postId);

    // Fetch comments if not already populated
    const targetPost = posts.find((p) => p._id === postId);
    if (!targetPost?.comments || targetPost.comments.length === 0) {
      try {
        const res = await postsAPI.getComments(postId);
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, comments: res.data.data.comments } : p))
        );
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
  };

  // ─── Tab and Filter Controls ─────────────────────────────────────────────────
  const setTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const setTag = (tag) => {
    const newParams = new URLSearchParams(searchParams);
    if (tag) newParams.set('tag', tag);
    else newParams.delete('tag');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set('tab', activeTab);
    setSearchParams(newParams);
  };

  // ─── Formatted Content Renderer (Hashtags & Mentions) ────────────────────────
  const renderFormattedContent = (text) => {
    if (!text) return null;

    // Tokenize by whitespace while preserving links, hashtags, and mentions
    const words = text.split(/(\s+)/);
    return words.map((token, i) => {
      if (token.startsWith('#') && token.length > 1) {
        const tag = token.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setTag(tag);
            }}
            style={{
              color: 'var(--accent, #6366f1)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            title={`Filter by #${tag}`}
          >
            {token}
          </span>
        );
      }

      if (token.startsWith('@') && token.length > 1) {
        const username = token.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <Link
            key={i}
            to={`/profile/${username}`}
            style={{
              color: '#3b82f6',
              fontWeight: 600,
              textDecoration: 'none',
            }}
            title={`View @${username}`}
          >
            {token}
          </Link>
        );
      }

      return token;
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
      {/* ─── Main Feed Column ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        {/* Feed Tabs Navigation */}
        <div
          className="card"
          style={{
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTab('for-you')}
              className={`btn ${activeTab === 'for-you' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', gap: '0.35rem' }}
            >
              <Compass size={16} /> For You
            </button>
            <button
              onClick={() => setTab('latest')}
              className={`btn ${activeTab === 'latest' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', gap: '0.35rem' }}
            >
              <Clock size={16} /> Latest
            </button>
            <button
              onClick={() => setTab('following')}
              className={`btn ${activeTab === 'following' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', gap: '0.35rem' }}
            >
              <Users size={16} /> Following
            </button>
            <button
              onClick={() => setTab('trending')}
              className={`btn ${activeTab === 'trending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', gap: '0.35rem' }}
            >
              <TrendingUp size={16} /> Trending
            </button>
          </div>

          <button
            onClick={() => fetchFeed(1, false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Refresh feed"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Active Filter Bar */}
        {(activeTag || searchQuery) && (
          <div
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 8,
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={16} color="var(--accent, #6366f1)" />
              <span>
                Filtering posts by: <strong>{activeTag ? `#${activeTag}` : `"${searchQuery}"`}</strong>
              </span>
            </div>
            <button
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent, #6366f1)',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <X size={14} /> Clear Filter
            </button>
          </div>
        )}

        {/* ─── Create Post Card ──────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '1.25rem', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: user?.avatar ? `url(${user.avatar}) center/cover` : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {!user?.avatar && (user?.displayName?.[0] || user?.username?.[0] || 'U')}
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                className="input"
                rows={3}
                placeholder="Share insights, ideas, or questions with your community... (use #tag or @user)"
                value={content}
                onChange={handleContentChange}
                style={{ resize: 'none', width: '100%', lineHeight: 1.5 }}
              />

              {/* Mention Suggestions Popover */}
              {mentionSuggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface, #1e1e2d)',
                    border: '1px solid var(--border, #2d2d3f)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    zIndex: 50,
                    maxHeight: 200,
                    overflowY: 'auto',
                    marginTop: 4,
                  }}
                >
                  <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Mention someone:
                  </div>
                  {mentionSuggestions.map((mUser) => (
                    <div
                      key={mUser._id}
                      onClick={() => applyMention(mUser.username)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderTop: '1px solid var(--border, #2d2d3f)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.05))')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: mUser.avatar ? `url(${mUser.avatar}) center/cover` : '#6366f1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {!mUser.avatar && (mUser.displayName?.[0] || mUser.username?.[0])}
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{mUser.displayName || mUser.username}</span>{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{mUser.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Image Previews */}
          {selectedImages.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: selectedImages.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              {selectedImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    maxHeight: selectedImages.length === 1 ? 260 : 140,
                    background: '#000',
                  }}
                >
                  <img
                    src={img.previewUrl}
                    alt={`Preview ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AI Helper Expandable Drawer */}
          {showAiHelper && (
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 8,
                padding: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent, #6366f1)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Bot size={16} /> AI Content Studio
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['engaging', 'professional', 'thoughtful'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAiTone(t)}
                      style={{
                        background: aiTone === t ? 'var(--accent, #6366f1)' : 'transparent',
                        color: aiTone === t ? '#fff' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '0.15rem 0.55rem',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  placeholder="Topic or idea (e.g. Modern AI workflows for developers)..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  style={{ fontSize: '0.85rem', flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={generatingAi || !aiPrompt.trim()}
                  onClick={() => handleAiDraft('generate')}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                >
                  {generatingAi ? 'Generating...' : 'Generate Post'}
                </button>
              </div>

              {content && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={generatingAi}
                    onClick={() => handleAiDraft('improve')}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    <Sparkles size={14} style={{ marginRight: 4 }} /> Refine & Polish Draft
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={selectedImages.length >= 4}
                style={{ fontSize: '0.85rem', gap: '0.35rem', padding: '0.45rem 0.8rem' }}
                title="Attach images (up to 4, max 5MB each)"
              >
                <ImageIcon size={16} />
                <span>Image {selectedImages.length > 0 && `(${selectedImages.length}/4)`}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAiHelper(!showAiHelper)}
                style={{
                  fontSize: '0.85rem',
                  gap: '0.35rem',
                  padding: '0.45rem 0.8rem',
                  borderColor: showAiHelper ? 'var(--accent, #6366f1)' : undefined,
                }}
              >
                <Sparkles size={16} color="var(--accent, #6366f1)" />
                <span>{showAiHelper ? 'Hide AI' : 'AI Assistant'}</span>
              </button>
            </div>

            <button
              className="btn btn-primary"
              disabled={submitting || (!content.trim() && selectedImages.length === 0)}
              onClick={handleCreatePost}
              style={{ padding: '0.45rem 1.25rem', gap: '0.35rem' }}
            >
              {submitting ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>

        {/* ─── Feed Stream ───────────────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton Loading Placeholders */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--border, #2d2d3f)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        width: '35%',
                        height: 14,
                        background: 'var(--border, #2d2d3f)',
                        borderRadius: 4,
                        marginBottom: 6,
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                    <div
                      style={{
                        width: '20%',
                        height: 10,
                        background: 'var(--border, #2d2d3f)',
                        borderRadius: 4,
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    width: '90%',
                    height: 12,
                    background: 'var(--border, #2d2d3f)',
                    borderRadius: 4,
                    marginBottom: 8,
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                <div
                  style={{
                    width: '65%',
                    height: 12,
                    background: 'var(--border, #2d2d3f)',
                    borderRadius: 4,
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <h3>Unable to load posts</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: '1.25rem' }}>
              {error}
            </p>
            <button className="btn btn-primary" onClick={() => fetchFeed(1, false)}>
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          /* Empty States per Tab */
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bot size={44} style={{ margin: '0 auto 1rem', opacity: 0.6, color: 'var(--accent, #6366f1)' }} />
            <h3 style={{ color: 'var(--text-primary)' }}>
              {activeTab === 'following'
                ? 'Your Following feed is quiet'
                : activeTag
                ? `No posts tagged with #${activeTag}`
                : searchQuery
                ? `No posts found for "${searchQuery}"`
                : 'No posts yet'}
            </h3>
            <p style={{ marginTop: '0.5rem', maxWidth: 420, margin: '0.5rem auto 1.5rem', fontSize: '0.9rem' }}>
              {activeTab === 'following'
                ? 'Discover talented creators in the For You or Trending tabs and follow them to see their posts here.'
                : activeTag
                ? 'Be the first creator to share an insight using this hashtag!'
                : 'Be the first to share an insight or compose a post using the AI Assistant!'}
            </p>
            {activeTab === 'following' && (
              <button className="btn btn-primary" onClick={() => setTab('for-you')}>
                Explore For You Feed
              </button>
            )}
            {activeTag && (
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear Filter
              </button>
            )}
          </div>
        ) : (
          /* Post Cards Stream */
          posts.map((post) => {
            const isOwner = post.author?._id === user?._id;
            const isLiked = post.isLikedByMe;
            const isBookmarked = post.isBookmarkedByMe;
            const isEditing = editingPostId === post._id;

            return (
              <div key={post._id} className="card" style={{ padding: '1.25rem' }}>
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.85rem',
                  }}
                >
                  <Link
                    to={`/profile/${post.author?._id}`}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: post.author?.avatar
                          ? `url(${post.author.avatar}) center/cover`
                          : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {!post.author?.avatar &&
                        (post.author?.displayName?.[0] || post.author?.username?.[0] || '?')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {post.author?.displayName || post.author?.username}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{post.author?.username} • {new Date(post.createdAt).toLocaleDateString()}{' '}
                        {post.isEdited && '(edited)'}
                      </div>
                    </div>
                  </Link>

                  {isOwner && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleStartEdit(post)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                        title="Edit post"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeletePost(post._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                        title="Delete post"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content / Editing Mode */}
                {isEditing ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <textarea
                      className="input"
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setEditingPostId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveEdit(post._id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                      marginBottom: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {renderFormattedContent(post.content)}
                  </div>
                )}

                {/* Media Image Gallery */}
                {post.images && post.images.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        post.images.length === 1
                          ? '1fr'
                          : post.images.length === 2
                          ? '1fr 1fr'
                          : 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {post.images.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          maxHeight: post.images.length === 1 ? 400 : 220,
                          background: '#000',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={`Attachment ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Hashtag Chips */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    {post.hashtags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => setTag(tag)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--accent, #6366f1)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title={`Filter by #${tag}`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Interactions Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    {/* Like Button */}
                    <button
                      onClick={() => handleLike(post._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        color: isLiked ? '#ef4444' : 'inherit',
                      }}
                      title={isLiked ? 'Unlike' : 'Like'}
                    >
                      <Heart size={18} fill={isLiked ? '#ef4444' : 'none'} />
                      <span>{post.likesCount || 0}</span>
                    </button>

                    {/* Comments Button */}
                    <button
                      onClick={() => handleToggleComments(post._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        color: activeCommentPostId === post._id ? 'var(--accent, #6366f1)' : 'inherit',
                      }}
                      title="Comments"
                    >
                      <MessageSquare size={18} />
                      <span>{post.commentsCount || 0}</span>
                    </button>

                    {/* Bookmark Button */}
                    <button
                      onClick={() => handleBookmark(post._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        color: isBookmarked ? 'var(--accent, #6366f1)' : 'inherit',
                      }}
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
                    >
                      <Bookmark size={18} fill={isBookmarked ? 'var(--accent, #6366f1)' : 'none'} />
                    </button>
                  </div>

                  {/* Share Button */}
                  <button
                    onClick={() => handleShare(post._id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                      color: copiedPostId === post._id ? '#22c55e' : 'inherit',
                    }}
                    title="Copy share link"
                  >
                    {copiedPostId === post._id ? <Check size={16} /> : <Share2 size={16} />}
                    <span>{copiedPostId === post._id ? 'Copied' : 'Share'}</span>
                  </button>
                </div>

                {/* ─── Expandable Comments Section ───────────────────────────── */}
                {activeCommentPostId === post._id && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      <input
                        className="input"
                        placeholder="Write a comment... (use @username to mention)"
                        value={commentText[post._id] || ''}
                        onChange={(e) =>
                          setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))
                        }
                        style={{ fontSize: '0.85rem' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post._id);
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={submittingComment[post._id] || !commentText[post._id]?.trim()}
                        onClick={() => handleAddComment(post._id)}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        <Send size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(post.comments || []).map((comm, idx) => (
                        <div
                          key={comm._id || idx}
                          style={{
                            background: 'var(--surface, #1e1e2d)',
                            padding: '0.6rem 0.85rem',
                            borderRadius: 6,
                            fontSize: '0.85rem',
                            border: '1px solid var(--border, #2d2d3f)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <Link
                              to={`/profile/${comm.author?._id}`}
                              style={{
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                color: 'var(--accent, #6366f1)',
                                textDecoration: 'none',
                              }}
                            >
                              {comm.author?.displayName || comm.author?.username || 'User'}
                            </Link>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {comm.createdAt ? new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div style={{ lineHeight: 1.4 }}>{renderFormattedContent(comm.content)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={loadMoreRef} style={{ height: 20, textAlign: 'center' }}>
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Right Discovery Sidebar ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Search Widget */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Search size={16} color="var(--accent, #6366f1)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Search Discussions</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              className="input"
              placeholder="Keywords, topics..."
              value={searchQuery}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams);
                if (e.target.value.trim()) newParams.set('search', e.target.value);
                else newParams.delete('search');
                setSearchParams(newParams);
              }}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Trending Hashtags Widget */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            <TrendingUp size={18} color="var(--accent, #6366f1)" />
            <span>Trending Topics</span>
          </div>

          {loadingTags ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 24,
                    background: 'var(--border, #2d2d3f)',
                    borderRadius: 4,
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ) : trendingTags.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No trending hashtags yet. Include #hashtags in your posts to spark trends!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {trendingTags.map((item) => (
                <div
                  key={item.tag}
                  onClick={() => setTag(item.tag)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '0.35rem 0.5rem',
                    borderRadius: 6,
                    background: activeTag === item.tag ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTag !== item.tag) e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.03))';
                  }}
                  onMouseLeave={(e) => {
                    if (activeTag !== item.tag) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: activeTag === item.tag ? 'var(--accent, #6366f1)' : 'var(--text-primary)',
                    }}
                  >
                    #{item.tag}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.count} {item.count === 1 ? 'post' : 'posts'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Algorithm Transparency Card */}
        <div
          className="card"
          style={{
            padding: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Social Intelligence Feed
          </div>
          <p>
            Trending scores update dynamically using real interaction signals:
          </p>
          <code
            style={{
              display: 'block',
              background: 'rgba(0,0,0,0.2)',
              padding: '0.4rem',
              borderRadius: 4,
              marginTop: '0.35rem',
              fontSize: '0.75rem',
            }}
          >
            (Likes×2 + Comments×3) / (Age + 2)^1.5
          </code>
        </div>
      </div>
    </div>
  );
}
