import { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminAccess() {
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    try {
      const response = await adminAPI.getInvitations();
      setInvitations(response.data.data.invitations || []);
    } catch {
      toast({ message: 'Failed to load access invitations', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const invite = async (event) => {
    event.preventDefault();
    try {
      await adminAPI.createInvitation({ email });
      setEmail('');
      toast({ message: 'Administrator invitation sent', type: 'success' });
      load();
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Invitation failed', type: 'error' });
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('Revoke this unused administrator invitation?')) return;
    await adminAPI.revokeInvitation(id);
    toast({ message: 'Invitation revoked', type: 'info' });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div><h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Access Management</h1><p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Invite and govern administrator access without exposing credentials.</p></div>
      <form className="card" onSubmit={invite} style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label htmlFor="invite-email" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Invite email</label>
        <input id="invite-email" className="input" type="email" placeholder="administrator@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required style={{ flex: 1, minWidth: 240 }} />
        <button className="btn btn-primary" type="submit">Send invitation</button>
      </form>
      <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
        {loading ? <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading invitations…</div> : invitations.length === 0 ? <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No administrator invitations.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th>Email</th><th>Invited by</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>{invitations.map((item) => {
              const status = item.acceptedAt ? 'Accepted' : item.revokedAt ? 'Revoked' : new Date(item.expiresAt) < new Date() ? 'Expired' : 'Pending';
              return <tr key={item._id} style={{ borderTop: '1px solid var(--border)' }}><td>{item.email}</td><td>{item.invitedBy?.username || 'Admin'}</td><td>{new Date(item.expiresAt).toLocaleString()}</td><td>{status}</td><td>{status === 'Pending' && <button className="btn btn-secondary" onClick={() => revoke(item._id)} type="button">Revoke</button>}</td></tr>;
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
