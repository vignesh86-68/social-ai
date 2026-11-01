import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form);
      if (data.data.user.role !== 'admin') {
        await logout();
        setError('This account does not have administrator access.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Administrator sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#312e81,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={23} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.35rem' }}>SOCIAL AI</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Administrator Sign In</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage your platform. Monitor activity. Drive decisions.</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && <div role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</div>}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">Administrator email</label>
              <input id="admin-email" className="input" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="form-label" htmlFor="admin-password">Password</label>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <LockKeyhole size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="admin-password" className="input" style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? 'Verifying access…' : 'Sign In to Admin Dashboard'}
            </button>
          </form>
          <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Return to standard sign-in</Link>
        </div>
      </div>
    </div>
  );
}
