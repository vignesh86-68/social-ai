import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../api';
import { useSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import { Bell, Heart, MessageSquare, Check, CheckCheck } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { clearUnread } = useSocket() || {};
  const { toast } = useToast();

  useEffect(() => {
    async function loadNotifications() {
      try {
        setLoading(true);
        const res = await notificationsAPI.getNotifications({ page: 1, limit: 30 });
        setNotifications(res.data.data.notifications || []);
        if (clearUnread) clearUnread();
      } catch (err) {
        toast({ message: 'Failed to load notifications', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, [clearUnread, toast]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      if (clearUnread) clearUnread();
      toast({ message: 'All notifications marked as read', type: 'success' });
    } catch (err) {
      toast({ message: 'Failed to mark read', type: 'error' });
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart size={18} color="#ef4444" fill="#ef4444" />;
      case 'comment':
        return <MessageSquare size={18} color="var(--accent)" />;
      default:
        return <Bell size={18} color="var(--accent)" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Notifications</h2>
        {notifications.some(n => !n.isRead) && (
          <button
            className="btn btn-secondary"
            onClick={handleMarkAllRead}
            style={{ fontSize: '0.8rem', gap: '0.35rem' }}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No notifications yet</h3>
          <p style={{ marginTop: '0.5rem' }}>When people interact with your posts or content, you will see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className="card"
              style={{
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: notif.isRead ? 'var(--bg-card)' : 'var(--surface-hover)',
                borderLeft: notif.isRead ? '1px solid var(--border)' : '4px solid var(--accent)',
              }}
            >
              <div style={{ padding: '0.5rem', background: 'var(--surface)', borderRadius: '50%' }}>
                {getIcon(notif.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{notif.sender?.displayName || notif.sender?.username || 'Someone'}</strong>{' '}
                  {notif.type === 'like' && 'liked your post.'}
                  {notif.type === 'comment' && 'commented on your post.'}
                  {notif.type === 'admin_alert' && 'Security notification: New administrative login recorded.'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                  • {new Date(notif.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

