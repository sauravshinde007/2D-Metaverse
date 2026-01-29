// client/src/context/AuthContext.jsx

import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import socketService from '../services/socketService'; // ✅ fixed path

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const login = useCallback((userData, userToken) => {
    setToken(userToken);
    setUser(userData);
    localStorage.setItem('token', userToken);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Close socket connection
    socketService.disconnect();

    // (Optional safety) Kill Phaser game if still running
    if (window._phaserGame) {
      window._phaserGame.destroy(true);
      window._phaserGame = null;
    }
  }, []);

  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

  // Restore session from localStorage on first load, THEN verify with server
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken) {
        // 1. Optimistically load from localStorage first (fast render)
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }

        // 2. Background fetch to get FRESH data (fix stale avatar issues)
        try {
          const response = await fetch(`${serverUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });

          if (response.ok) {
            const freshUser = await response.json();
            setUser(freshUser);
            // Update localStorage with truth
            localStorage.setItem('user', JSON.stringify(freshUser));
          } else {
            // Token invalid or expired
            console.warn("Session expired or invalid, logging out.");
            logout();
          }
        } catch (err) {
          console.error("Failed to verify session:", err);
          // If network error, we might keep the local user, or logout. 
          // Keeping local user is safer for shaky connections.
        }
      }
    };

    initAuth();
  }, [logout]);

  // 🔴 Listen for server-side forceDisconnect ONLY when logged in
  useEffect(() => {
    if (!user) return;

    // Ensure socket is connected for this user
    socketService.connect();

    const handleForceDisconnect = (message) => {
      alert(message || 'Session terminated due to a new login from another device.');
      logout();
    };

    // Use the generic "on" helper (no race/timeout logic)
    socketService.on('forceDisconnect', handleForceDisconnect);

    return () => {
      // We’ll add an 'off' helper to socketService in a second
      socketService.off?.('forceDisconnect', handleForceDisconnect);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
