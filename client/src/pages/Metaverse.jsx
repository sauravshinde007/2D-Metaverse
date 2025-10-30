// client/src/pages/Metaverse.jsx
import { useEffect } from "react";
import "../styles/App.css";
import startGame from "../phaser";
import HUD from "../components/HUD";
import { ChatProvider } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";

function Metaverse() {
  const { logout } = useAuth();

  useEffect(() => {
    const game = startGame();
    
    // Define a handler for the custom event
    const handleLogoutRequest = () => {
        logout();
    };

    // Listen for the custom event from Phaser
    window.addEventListener('request-logout', handleLogoutRequest);
    
    return () => {
      // Cleanup when the component unmounts
      if (window._phaserGame) {
        window._phaserGame.destroy(true);
        window._phaserGame = null;
      }
      window.removeEventListener('request-logout', handleLogoutRequest);
    };
  }, [logout]);

  return (
    <ChatProvider>
        <div className="app-root">
            <div id="game-container" className="game-container" />
            <div className="hud-root">
                <HUD />
            </div>
            <button 
                onClick={logout} 
                style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 101 }}
            >
                Logout
            </button>
        </div>
    </ChatProvider>
  );
}

export default Metaverse;