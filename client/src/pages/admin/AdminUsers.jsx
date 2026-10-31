import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';
import { UserCheck, UserX, Shield, Search } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getUsers({ search, role: filterRole || undefined });
      setUsers(res.data.data.users || []);
    } catch (err) {
      toast({ message: 'Failed to load users list', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleSuspend = async (user) => {
    const isSuspended = user.isSuspended;
    const actionPrompt = isSuspended
      ? `Reactivate account for @${user.username}?`
      : `Provide suspension reason for @${user.username}:`;

    if (isSuspended) {
      if (!window.confirm(actionPrompt)) return;
      try {
        await adminAPI.reactivateUser(user._id);
        toast({ message: `@${user.username} reactivated`, type: 'success' });
        setUsers(users.map(u => u._id === user._id ? { ...u, isSuspended: false, suspendedReason: null } : u));
      } catch (err) {
        toast({ message: 'Reactivation failed', type: 'error' });
      }
    } else {
      const reason = window.prompt(actionPrompt, 'Violation of community policies');
      if (!reason) return;
      try {
        await adminAPI.suspendUser(user._id, { reason });
        toast({ message: `@${user.username} suspended`, type: 'info' });
        setUsers(users.map(u => u._id === user._id ? { ...u, isSuspended: true, suspendedReason: reason } : u));
      } catch (err) {
        toast({ message: 'Suspension failed', type: 'error' });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>User Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Inspect registrations, enforce policies, and manage suspensions.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0.5rem', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>User</th>
                <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <strong>{u.displayName || u.username}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: u.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'var(--surface)',
                      color: u.role === 'admin' ? 'var(--accent)' : 'inherit'
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: u.isSuspended ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      color: u.isSuspended ? '#ef4444' : '#22c55e'
                    }}>
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {u.role !== 'admin' && (
                      <button
                        className={`btn ${u.isSuspended ? 'btn-secondary' : 'btn-secondary'}`}
                        onClick={() => handleToggleSuspend(u)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          color: u.isSuspended ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {u.isSuspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

