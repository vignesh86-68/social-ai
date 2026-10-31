import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socket) { socket.disconnect(); setSocket(null); }
      return;
    }

    // Get the access token from a cookie or refetch — for simplicity we pass
    // a session flag; the real token is in the HttpOnly cookie handled by axios.
    // Socket auth uses the same JWT stored in the cookie or re-fetched via /auth/me.
    // We'll use a lightweight approach: request a short-lived socket token from server.
    // For now we connect without explicit token (server validates via cookie in upgrade).
    const s = io('/', {
      withCredentials: true,
      auth: { token: '' }, // server validates via cookie
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => console.log('🔌 Socket connected'));
    s.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    });
    s.on('disconnect', () => console.log('🔌 Socket disconnected'));

    setSocket(s);
    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, clearUnread }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
