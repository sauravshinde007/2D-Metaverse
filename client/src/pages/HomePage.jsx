import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    // Use a React Fragment <> to return multiple elements
    <>
      <header className="navbar">
        {/* This new inner div will center the content */}
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

      {/* The landing-container now only wraps the main content */}
      <div className="landing-container">
        <main>
          <section className="hero">
            <h1>
              Your Office Metaverse
              <br />
              <span className="gradient-text">for Work, At Scale.</span>
            </h1>
            <p className="subtitle">
              The leading open-source, decentralized platform for running your virtual office in production.
            </p>
            <div className="hero-buttons">
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-secondary">Login to Your Office</Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default HomePage;