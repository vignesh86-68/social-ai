import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Auth pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import VerifyEmail from '../pages/auth/VerifyEmail';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

// App pages
import Feed from '../pages/dashboard/Feed';
import Profile from '../pages/dashboard/Profile';
import EditProfile from '../pages/dashboard/EditProfile';
import Notifications from '../pages/dashboard/Notifications';
import AIStudio from '../pages/dashboard/AIStudio';
import SignalIntelligence from '../pages/dashboard/SignalIntelligence';

// Admin pages
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminPosts from '../pages/admin/AdminPosts';
import AdminAuditLogs from '../pages/admin/AdminAuditLogs';
import AdminLogin from '../pages/admin/AdminLogin';
import AdminAccess from '../pages/admin/AdminAccess';
import AdminInvitationAccept from '../pages/admin/AdminInvitationAccept';

// Layout
import AppLayout from '../components/layout/AppLayout';
import LoadingScreen from '../components/common/LoadingScreen';

// ─── Guards ───────────────────────────────────────────────────────────────────
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}

function RedirectIfAuthed() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace /> : <Outlet />;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public administrator entry routes must remain reachable even when a
            normal-user session is already present. The login handler itself
            enforces the administrator role before entering the Command Centre. */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/invitations/accept" element={<AdminInvitationAccept />} />

        {/* Public auth routes */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Protected user routes */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Feed />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/ai-studio" element={<AIStudio />} />
            <Route path="/signal-intelligence" element={<SignalIntelligence />} />
          </Route>
        </Route>

        {/* Protected admin routes */}
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/posts" element={<AdminPosts />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/access" element={<AdminAccess />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
