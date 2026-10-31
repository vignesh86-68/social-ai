import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, postsAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  User,
  MapPin,
  Globe,
  Calendar,
  Edit3,
  Heart,
  MessageSquare,
  UserPlus,
  UserCheck,
  Users,
  X,
  Sparkles,
} from 'lucide-react';

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  // Modal states for followers / following list
  const [modalType, setModalType] = useState(null); // 'followers' | 'following' | null
  const [modalList, setModalList] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const isOwn = currentUser?._id === userId;

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [profRes, postRes] = await Promise.all([
        usersAPI.getProfile(userId),
        usersAPI.getUserPosts(userId, { page: 1, limit: 30 }),
      ]);
      setProfile(profRes.data.data.user);
      setPosts(postRes.data.data.posts || []);
    } catch (err) {
      toast({ message: 'Failed to load profile', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleToggleFollow = async () => {
    if (!currentUser) return;
    setFollowLoading(true);
    try {
      const res = await usersAPI.toggleFollow(userId);
      const { isFollowing, followersCount } = res.data.data;
      setProfile((prev) => ({
        ...prev,
        isFollowing,
        followersCount,
      }));
      toast({
        message: isFollowing ? `You are now following @${profile.username}` : `Unfollowed @${profile.username}`,
        type: 'info',
      });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to update follow status', type: 'error' });
    } finally {
      setFollowLoading(false);
    }
  };

  const openFollowModal = async (type) => {
    setModalType(type);
    setModalLoading(true);
    try {
      const res =
        type === 'followers'
          ? await usersAPI.getFollowers(userId)
          : await usersAPI.getFollowing(userId);
      setModalList(type === 'followers' ? res.data.data.followers : res.data.data.following);
    } catch (err) {
      toast({ message: `Could not load ${type}`, type: 'error' });
      setModalType(null);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>User not found</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>This profile may have been removed or does not exist.</p>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          Back to Feed
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Profile Header with Banner Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Cover Banner */}
        <div
          style={{
            height: 180,
            background: profile.coverImage
              ? `url(${profile.coverImage}) center/cover no-repeat`
              : 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.5))',
            }}
          />
        </div>

        {/* Profile Info Bar */}
        <div style={{ padding: '0 1.75rem 1.75rem', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: -48,
              marginBottom: '1rem',
            }}
          >
            {/* Avatar & Display Names */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem' }}>
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid var(--bg-card)',
                    boxShadow: 'var(--shadow-lg)',
                    background: 'var(--bg-card)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    border: '4px solid var(--bg-card)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  {profile.displayName?.[0] || profile.username?.[0] || 'U'}
                </div>
              )}

              <div style={{ paddingBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {profile.displayName || profile.username}
                  </h1>
                  {profile.followsYou && !isOwn && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'var(--surface-hover)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                      }}
                    >
                      Follows you
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@{profile.username}</div>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div>
              {isOwn ? (
                <Link
                  to="/profile/edit"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                >
                  <Edit3 size={16} /> Edit Profile
                </Link>
              ) : (
                <button
                  className={`btn ${profile.isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={followLoading}
                  onClick={handleToggleFollow}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 120, justifyContent: 'center' }}
                >
                  {profile.isFollowing ? (
                    <>
                      <UserCheck size={16} /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Follow
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 650, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {profile.bio}
            </p>
          )}

          {/* Metrics & Metadata Row */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            {/* Follower / Following Interactive Counts */}
            <button
              onClick={() => openFollowModal('followers')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                padding: 0,
              }}
            >
              <strong>{profile.followersCount || 0}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Followers</span>
            </button>

            <button
              onClick={() => openFollowModal('following')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                padding: 0,
              }}
            >
              <strong>{profile.followingCount || 0}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Following</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <strong>{posts.length}</strong> <span style={{ color: 'var(--text-muted)' }}>Posts</span>
            </div>

            {/* Profile Info Details */}
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <MapPin size={15} /> {profile.location}
              </div>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem' }}
              >
                <Globe size={15} /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Calendar size={15} /> Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Published Posts</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{posts.length} total</span>
      </div>

      {posts.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Sparkles size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
          <h3>No posts yet</h3>
          <p style={{ marginTop: '0.35rem' }}>This user hasn't published any thoughts or insights yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {posts.map((post) => (
            <div key={post._id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {new Date(post.createdAt).toLocaleDateString()} {post.isEdited && '• Edited'}
              </div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {post.content}
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Heart size={16} /> {post.likesCount || post.likes?.length || 0}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MessageSquare size={16} /> {post.commentsCount || post.comments?.length || 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Followers / Following Modal */}
      {modalType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setModalType(null)}
        >
          <div
            className="card animate-fade-in"
            style={{ width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ textTransform: 'capitalize', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {modalType} ({modalList.length})
              </h3>
              <button
                onClick={() => setModalType(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {modalLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} />
                </div>
              ) : modalList.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No {modalType} found.
                </div>
              ) : (
                modalList.map((u) => (
                  <Link
                    key={u._id}
                    to={`/profile/${u._id}`}
                    onClick={() => setModalType(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.username} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        {u.displayName?.[0] || u.username?.[0] || 'U'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.displayName || u.username}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
