import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import socketService from './services/socketService';
import { useEffect } from 'react';

import './styles/App.css';

//pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

//game
import Metaverse from './pages/Metaverse';

const GameNotifications = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated) return;

        // Ensure connected
        socketService.connect();

        const handlePlayerJoined = (player) => {
            addNotification(`${player.username} joined the Metaverse`, 'success');
        };

        const handlePlayerLeft = (id) => {
            addNotification(`A player left the world`, 'warning');
        };

        // We need to wait for socket to be actually assigned in the service
        // But since we called connect, it should be synchronous for assignment (though connection is async).
        // Let's attach listeners using the service wrapper methods which should ideally handle it or we assume it's set.

        // IMPORTANT: The socketService.socket getter might be null if connect() hasn't run yet.
        // We just called connect(), so it should be initialized.

        socketService.onPlayerJoined(handlePlayerJoined);
        socketService.onPlayerLeft(handlePlayerLeft);

        return () => {
            socketService.off('playerJoined', handlePlayerJoined);
            socketService.off('playerLeft', handlePlayerLeft);
        };
    }, [isAuthenticated, addNotification]);

    return null;
};

function App() {
    const { isAuthenticated } = useAuth();

    return (
        <NotificationProvider>
            <GameNotifications />
            <Router>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/metaverse" />} />
                    <Route path="/signup" element={!isAuthenticated ? <SignupPage /> : <Navigate to="/metaverse" />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                    <Route
                        path="/metaverse"
                        element={isAuthenticated ? <Metaverse /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/calendar"
                        element={isAuthenticated ? <Metaverse /> : <Navigate to="/login" />}
                    />
                </Routes>
            </Router>
        </NotificationProvider>
    );
}

export default App;