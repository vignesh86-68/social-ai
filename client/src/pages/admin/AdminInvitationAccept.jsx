import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { authAPI } from '../../api';

export default function AdminInvitationAccept() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', displayName: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await authAPI.acceptAdminInvitation({ ...form, token: params.get('token') || '' });
      setMessage('Administrator account created. You can now sign in.');
      setTimeout(() => navigate('/admin/login', { replace: true }), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Invitation could not be accepted');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <ShieldCheck size={38} color="#6366f1" />
          <h1 style={{ fontSize: '1.5rem', margin: '0.75rem 0 0.25rem' }}>Accept administrator invitation</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create your secure SOCIAL AI Command Centre account.</p>
        </div>
        <form className="card" onSubmit={submit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div role="alert" style={{ color: '#ef4444' }}>{error}</div>}
          {message && <div role="status" style={{ color: '#16a34a' }}>{message}</div>}
          <label className="form-group"><span className="form-label">Username</span><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label className="form-group"><span className="form-label">Display name</span><input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">Password</span><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <button className="btn btn-primary btn-lg" disabled={loading || !params.get('token')} type="submit">{loading ? 'Creating account…' : 'Create administrator account'}</button>
          <Link to="/admin/login" style={{ textAlign: 'center', color: 'var(--accent)' }}>Return to admin sign-in</Link>
        </form>
      </div>
    </div>
  );
}
