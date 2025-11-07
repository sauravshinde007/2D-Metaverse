import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${serverUrl}/api/auth/login`, {
        username,
        password,
      });
      const { token, ...userData } = response.data;
      login(userData, token);
      navigate('/metaverse');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log in.');
    }
  };

  return (
    // 2. Use the wrapper for the background and centering
    <div className="homepage-wrapper auth-page">
      {/* 3. Add blobs for the background */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <Link to="/" className="back-link">
        &lt; Back to Home
      </Link>

      {/* 4. This container is now the styled "card" */}
      <div className="auth-container">
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Welcome Back!</h2>
          <p className="auth-subtitle">We're so excited to see you again!</p>
          
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {error && <p className="error-message">{error}</p>}
          
          {/* 5. Use the themed button class */}
          <button type="submit" className="btn btn-secondary">
            Log In
          </button>
          
          <p className="switch-auth">
            Need an account? <Link to="/signup">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;