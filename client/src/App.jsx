import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

//pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

//game
import Metaverse from './pages/Metaverse';

function App() {
    const { isAuthenticated } = useAuth();

    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/metaverse" />} />
                <Route path="/signup" element={!isAuthenticated ? <SignupPage /> : <Navigate to="/metaverse" />} />
                <Route 
                    path="/metaverse" 
                    element={isAuthenticated ? <Metaverse /> : <Navigate to="/login" />} 
                />
            </Routes>
        </Router>
    );
}

export default App;