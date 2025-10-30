// client/src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '20%' }}>
      <h1>Welcome to the 2D Metaverse</h1>
      <p>Please log in or sign up to continue.</p>
      <div>
        <Link to="/login" style={{ marginRight: '1rem' }}>
          <button>Login</button>
        </Link>
        <Link to="/signup">
          <button>Sign Up</button>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;