import { Link } from 'react-router-dom';
import '../styles/HomePage.css'; // 1. Import the new stylesheet

const HomePage = () => {
  return (
    // This wrapper will hold the background and blobs
    <div className="homepage-wrapper">
      {/* 2. Add the floating blobs */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <header className="homepage-navbar">
        <div className="navbar-content">
          <a href="/" className="logo">
            Metaverse
          </a>
          <div className="nav-buttons">
            <Link to="/login" className="btn btn-secondary">
              Login
            </Link>
            <Link to="/signup" className="btn btn-primary">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* 3. The hero-container will be centered on top */}
      <div className="hero-container">
        <main>
          <section className="hero">
            <h1>
              Your Collaborative Space
              <br />
              <span className="gradient-text">for Remote Collaborations.</span>
            </h1>
            <p className="subtitle">
              A metaverse platform for building shared, collaborative spaces.
              Create virtual hubs for teamwork and learning, like online offices 
              or digital libraries.
            </p>
            <div className="hero-buttons">
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-secondary">Login to Your Space</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default HomePage;