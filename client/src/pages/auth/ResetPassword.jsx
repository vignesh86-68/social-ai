import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.password.length < 8) errs.password = 'At least 8 characters';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Must contain an uppercase letter';
    else if (!/\d/.test(form.password)) errs.password = 'Must contain a number';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setLoading(true);
    try {
      await authAPI.resetPassword({ token: params.get('token'), email: params.get('email'), password: form.password });
      setDone(true);
      toast({ message: 'Password reset! You can now sign in.', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Reset failed. The link may have expired.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <span style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: '1.4rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Social AI</span>
          </div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Set New Password</h1>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 1rem' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Password Updated!</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Sign in with your new password.</p>
              <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>Sign In</button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className={`input ${errors.password ? 'error' : ''}`} style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }} type={showPw ? 'text' : 'password'} placeholder="Min 8 chars, uppercase, number" value={form.password} onChange={set('password')} />
                  <button type="button" onClick={() => setShowPw((p) => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className={`input ${errors.confirm ? 'error' : ''}`} style={{ paddingLeft: '2.5rem' }} type={showPw ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirm} onChange={set('confirm')} />
                </div>
                {errors.confirm && <span className="form-error">{errors.confirm}</span>}
              </div>
              <button className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />Resetting…</> : 'Reset Password'}
              </button>
              <Link to="/login" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>Back to login</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

