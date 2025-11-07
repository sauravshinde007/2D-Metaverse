import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// 1. Import the two CSS files
import '../styles/HomePage.css'; // For background, blobs, and button styles
import '../styles/AuthPage.css'; // For the form card styles

const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${serverUrl}/api/auth/signup`, {
        username,
        password,
      });
      const { token, ...userData } = response.data;
      login(userData, token);
      navigate('/metaverse');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign up.');
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

      {/* 4. This container is the styled "card" */}
      <div className="auth-container">
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Create an account</h2>
          <p className="auth-subtitle">Join the metaverse today!</p>
          
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
            Sign Up
          </button>
          
          <p className="switch-auth">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;