import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';
import { Trash2, MessageSquare, Heart, ShieldAlert } from 'lucide-react';

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getAllPosts({ page: 1, limit: 30 });
      setPosts(res.data.data.posts || []);
    } catch (err) {
      toast({ message: 'Failed to load content for moderation', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Moderator action: Confirm removal of this post across the platform?')) return;
    try {
      await adminAPI.deletePost(postId);
      setPosts(posts.filter(p => p._id !== postId));
      toast({ message: 'Post purged and recorded in audit log', type: 'info' });
    } catch (err) {
      toast({ message: 'Failed to delete post', type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Content Moderation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Review platform posts and remove inappropriate or violating entries.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No posts available to moderate.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {posts.map((post) => (
            <div key={post._id} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <strong>{post.author?.displayName || post.author?.username || 'Unknown'}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{post.author?.username} • {new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span><Heart size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {post.likesCount || post.likes?.length || 0}</span>
                  <span><MessageSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {post.commentsCount || post.comments?.length || 0}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => handleDeletePost(post._id)}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', fontSize: '0.8rem', gap: '0.35rem' }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

