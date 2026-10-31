import { useState, useEffect, useCallback } from 'react';
import { Sparkles, MessageSquare, Heart, Share2, Trash2, Edit3, Send, Bot, RefreshCw } from 'lucide-react';
import { postsAPI, aiAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router-dom';

export default function Feed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const res = await postsAPI.getFeed({ page: 1, limit: 20 });
      setPosts(res.data.data.posts || []);
    } catch (err) {
      toast({ message: 'Failed to load posts feed', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await postsAPI.createPost({ content });
      setPosts([res.data.data.post, ...posts]);
      setContent('');
      setShowAiHelper(false);
      toast({ message: 'Post published!', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Could not publish post', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

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
      };
      const res = await aiAPI.contentStudio(payload);
      setContent(res.data.data.result);
      toast({ message: 'AI suggestion inserted! Review before posting.', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'AI generation failed', type: 'error' });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await postsAPI.toggleLike(postId);
      const { liked, likesCount } = res.data.data;
      setPosts(posts.map(p => {
        if (p._id === postId) {
          const updatedLikes = liked 
            ? [...(p.likes || []), user._id] 
            : (p.likes || []).filter(id => id !== user._id);
          return { ...p, likes: updatedLikes, likesCount };
        }
        return p;
      }));
    } catch (err) {
      toast({ message: 'Failed to update like', type: 'error' });
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postsAPI.deletePost(postId);
      setPosts(posts.filter(p => p._id !== postId));
      toast({ message: 'Post deleted', type: 'info' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to delete post', type: 'error' });
    }
  };

  const handleStartEdit = (post) => {
    setEditingPostId(post._id);
    setEditContent(post.content);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    try {
      const res = await postsAPI.updatePost(postId, { content: editContent });
      setPosts(posts.map(p => p._id === postId ? { ...p, content: res.data.data.post.content, isEdited: true } : p));
      setEditingPostId(null);
      toast({ message: 'Post updated', type: 'success' });
    } catch (err) {
      toast({ message: 'Failed to update post', type: 'error' });
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentText[postId];
    if (!text || !text.trim()) return;
    try {
      const res = await postsAPI.addComment(postId, { content: text });
      setPosts(posts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            comments: [...(p.comments || []), res.data.data.comment],
            commentsCount: (p.commentsCount || 0) + 1
          };
        }
        return p;
      }));
      setCommentText({ ...commentText, [postId]: '' });
      toast({ message: 'Comment added', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to add comment', type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Create Post Card */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700
          }}>
            {user?.displayName?.[0] || user?.username?.[0] || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              className="input"
              rows={3}
              placeholder="What's on your mind? Share thoughts with your network..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ resize: 'none', width: '100%' }}
            />
          </div>
        </div>

        {/* AI Helper Toggle */}
        {showAiHelper && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.75rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
              <Bot size={16} /> AI Content Studio
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder="Topic or idea (e.g. Trends in AI Agents 2026)..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={generatingAi}
                onClick={() => handleAiDraft('generate')}
                style={{ whiteSpace: 'nowrap' }}
              >
                {generatingAi ? 'Generating...' : 'Generate Post'}
              </button>
            </div>
            {content && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={generatingAi}
                onClick={() => handleAiDraft('improve')}
                style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
              >
                <Sparkles size={14} style={{ marginRight: 4 }} /> Enhance Current Draft
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAiHelper(!showAiHelper)}
            style={{ fontSize: '0.85rem', gap: '0.4rem' }}
          >
            <Sparkles size={16} color="var(--accent)" />
            {showAiHelper ? 'Close AI Studio' : 'AI Assistant'}
          </button>

          <button
            className="btn btn-primary"
            disabled={submitting || !content.trim()}
            onClick={handleCreatePost}
          >
            {submitting ? 'Publishing...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bot size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No posts yet</h3>
          <p style={{ marginTop: '0.5rem' }}>Be the first to share an insight or write a post with AI assist!</p>
        </div>
      ) : (
        posts.map((post) => {
          const isOwner = post.author?._id === user?._id;
          const isLiked = (post.likes || []).includes(user?._id);
          const isEditing = editingPostId === post._id;

          return (
            <div key={post._id} className="card" style={{ padding: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <Link to={`/profile/${post.author?._id}`} style={{ display: 'flex', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700
                  }}>
                    {post.author?.displayName?.[0] || post.author?.username?.[0] || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{post.author?.displayName || post.author?.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      @{post.author?.username} • {new Date(post.createdAt).toLocaleDateString()} {post.isEdited && '(edited)'}
                    </div>
                  </div>
                </Link>

                {isOwner && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleStartEdit(post)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
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
                    <button className="btn btn-secondary" onClick={() => setEditingPostId(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => handleSaveEdit(post._id)}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                  {post.content}
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '1.5rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}>
                <button
                  onClick={() => handleLike(post._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    color: isLiked ? '#ef4444' : 'inherit'
                  }}
                >
                  <Heart size={18} fill={isLiked ? '#ef4444' : 'none'} />
                  <span>{post.likesCount || post.likes?.length || 0}</span>
                </button>

                <button
                  onClick={() => setActiveCommentPostId(activeCommentPostId === post._id ? null : post._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    color: 'inherit'
                  }}
                >
                  <MessageSquare size={18} />
                  <span>{post.commentsCount || post.comments?.length || 0}</span>
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post._id && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      className="input"
                      placeholder="Write a comment..."
                      value={commentText[post._id] || ''}
                      onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                      style={{ fontSize: '0.85rem' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddComment(post._id);
                      }}
                    />
                    <button className="btn btn-primary" onClick={() => handleAddComment(post._id)}>
                      <Send size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(post.comments || []).map((comm, idx) => (
                      <div key={comm._id || idx} style={{
                        background: 'var(--surface)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 6,
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {comm.author?.displayName || comm.author?.username || 'User'}
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>{comm.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

