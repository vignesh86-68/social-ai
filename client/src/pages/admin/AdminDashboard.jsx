import { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';
import { Users, UserCheck, UserX, FileText, MessageSquare, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await adminAPI.getStats();
        setStats(res.data.data);
      } catch (err) {
        toast({ message: 'Failed to load administrative stats', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [toast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: '#6366f1' },
    { label: 'Verified Accounts', value: stats?.verifiedUsers || 0, icon: UserCheck, color: '#22c55e' },
    { label: 'Unverified Accounts', value: stats?.unverifiedUsers || 0, icon: UserX, color: '#f59e0b' },
    { label: 'Total Posts', value: stats?.totalPosts || 0, icon: FileText, color: '#3b82f6' },
    { label: 'Total Comments', value: stats?.totalComments || 0, icon: MessageSquare, color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Platform Intelligence & Overview</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time metrics and system health indicators.</p>
      </div>

      {/* Grid of cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${card.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: card.color
              }}>
                <Icon size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{card.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Registrations */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} color="var(--accent)" /> Recent Registrations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(stats?.recentUsers || []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent registrations.</div>
            ) : (
              (stats?.recentUsers || []).map((u) => (
                <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <strong>{u.displayName || u.username}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{u.username} • {u.email}</div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: u.isVerified ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: u.isVerified ? '#22c55e' : '#f59e0b'
                  }}>
                    {u.isVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Login Activities */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--accent)" /> Recent Successful Logins
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(stats?.recentLogins || []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent login records.</div>
            ) : (
              (stats?.recentLogins || []).map((l) => (
                <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <strong>{l.user?.username || 'User'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{l.ipAddress || 'Unknown IP'} • {l.device || 'Web Browser'}</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

