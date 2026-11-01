import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Users, FileText, ClipboardList, UserCog, LogOut, ArrowLeft, Sun, Moon, Menu, X, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageName = location.pathname === '/admin' ? 'Overview'
    : location.pathname.includes('/users') ? 'User Management'
      : location.pathname.includes('/posts') ? 'Content Moderation'
        : location.pathname.includes('/audit-logs') ? 'Audit Logs' : 'Access Management';

  return (
    <div className="admin-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Admin Sidebar */}
      <aside className={`admin-sidebar${mobileOpen ? ' mobile-open' : ''}`} style={{
        width: 250,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Admin Portal</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SOCIAL AI System</div>
          </div>
        </div>

        <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          <NavLink
            to="/admin"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
            })}
          >
            <Shield size={18} /> Overview
          </NavLink>
          <NavLink
            to="/admin/access"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem',
              borderRadius: 8, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
            })}
          >
            <UserCog size={18} /> Access Management
          </NavLink>

          <NavLink
            to="/admin/users"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
            })}
          >
            <Users size={18} /> User Management
          </NavLink>

          <NavLink
            to="/admin/posts"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
            })}
          >
            <FileText size={18} /> Content Moderation
          </NavLink>

          <NavLink
            to="/admin/audit-logs"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
            })}
          >
            <ClipboardList size={18} /> Audit Logs
          </NavLink>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.85rem', gap: '0.4rem', justifyContent: 'flex-start' }}
          >
            <ArrowLeft size={16} /> Return to App
          </button>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.85rem', gap: '0.4rem', justifyContent: 'flex-start', color: '#ef4444' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="admin-topbar" style={{
          height: 60,
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="admin-mobile-menu" type="button" aria-label="Open admin navigation" onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Command Centre</span> <ChevronRight size={14} style={{ verticalAlign: 'middle' }} /> <strong>{pageName}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="admin-search"><Search size={15} /><span>Search command centre</span></div>
            <button aria-label="Toggle theme" onClick={toggleTheme} style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '6px 10px', borderRadius: 8, gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem' }}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
