// client/src/context/AuthContext.jsx

import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import socketService from '../services/socketService'; // ✅ Import the socket service

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
        // This is now the ONLY place where local storage is cleared.
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Disconnect the socket as the final step of logging out.
        socketService.disconnect();
    }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            login(JSON.parse(storedUser), storedToken);
        }

        // ✅ ADDED: Set up a listener for the server-forced disconnect event.
        // This will now handle the logic for being logged out by another session.
        const handleForceDisconnect = (message) => {
            alert(message || 'Session terminated due to a new login from another device.');
            // We call the main logout function, which is the single source of truth for cleaning up.
            logout();
        };

        // We can't listen until the socket is connected. A simple delay or a more
        // complex event system could work. Let's assume the socket in World.js
        // connects quickly. We listen on the socket instance itself.
        // This check ensures we don't try to add a listener to a null object.
        if (socketService.socket) {
            socketService.socket.on('forceDisconnect', handleForceDisconnect);
        } else {
            // If the socket isn't ready yet, wait a moment. This handles timing.
            setTimeout(() => {
                if (socketService.socket) {
                    socketService.socket.on('forceDisconnect', handleForceDisconnect);
                }
            }, 1000); // Wait 1 second for the socket in Phaser to connect.
        }

        // Cleanup the listener when the provider unmounts
        return () => {
            if (socketService.socket) {
                socketService.socket.off('forceDisconnect', handleForceDisconnect);
            }
        };
    }, [login, logout]);

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);