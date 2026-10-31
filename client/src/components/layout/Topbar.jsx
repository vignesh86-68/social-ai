import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function Topbar({ onMenuClick }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header style={{
      height: 60,
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.25rem',
      gap: '0.75rem',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      backdropFilter: 'blur(8px)',
    }}>
      <button
        onClick={onMenuClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 6, borderRadius: 8 }}
        title="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div style={{ flex: 1 }} />

      <button
        onClick={toggleTheme}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '6px 10px', borderRadius: 8, gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', fontWeight: 500 }}
        title="Toggle theme"
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
        <span>{isDark ? 'Light' : 'Dark'}</span>
      </button>
    </header>
  );
}

