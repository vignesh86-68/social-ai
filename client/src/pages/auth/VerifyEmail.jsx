import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sparkles, CheckCircle, XCircle, Loader } from 'lucide-react';
import { authAPI } from '../../api';
import { useToast } from '../../contexts/ToastContext';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    const token = params.get('token');
    const userId = params.get('userId');
    const email = params.get('email');
    if (!token || (!userId && !email)) { setStatus('error'); return; }

    authAPI.verifyEmail({ token, userId, email })
      .then(() => { setStatus('success'); toast({ message: 'Email verified! You can now sign in.', type: 'success' }); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <span style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: '1.4rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Social AI</span>
          </div>
        </div>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          {status === 'verifying' && (
            <>
              <Loader size={48} style={{ color: 'var(--accent)', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
              <h2>Verifying your email…</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Please wait a moment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 1rem' }} />
              <h2>Email Verified!</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Your account is ready. Sign in to get started.</p>
              <Link to="/login"><button className="btn btn-primary btn-lg" style={{ width: '100%' }}>Sign In</button></Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
              <h2>Verification Failed</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>The link may have expired or is invalid. Request a new one from the login page.</p>
              <Link to="/login"><button className="btn btn-secondary btn-lg" style={{ width: '100%' }}>Back to Login</button></Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

