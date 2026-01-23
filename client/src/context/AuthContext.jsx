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

  // Restore session from localStorage on first load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      login(JSON.parse(storedUser), storedToken);
    }
  }, [login]);

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
