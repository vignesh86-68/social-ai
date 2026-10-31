import { Sparkles } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      gap: '1.25rem',
    }}>
      <div style={{
        width: 56,
        height: 56,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <Sparkles size={28} color="#fff" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 800,
          fontSize: '1.3rem',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>Social AI</span>
        <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
      </div>
    </div>
  );
}

