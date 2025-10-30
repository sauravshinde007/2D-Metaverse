// client/src/pages/Metaverse.jsx

import { useEffect } from "react";
import "../styles/App.css";
import startGame from "../phaser";
import HUD from "../components/HUD";
import { ChatProvider } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";

function Metaverse() {
    const { logout, user } = useAuth(); // We still need logout for the button

    useEffect(() => {
        if (user && user.username) {
            const game = startGame(user.username);

            return () => {
                if (window._phaserGame) {
                    window._phaserGame.destroy(true);
                    window._phaserGame = null;
                }
            };
        }
    }, [user]);

    return (
        <ChatProvider>
            <div className="app-root">
                <div id="game-container" className="game-container" />
                <div className="hud-root">
                    <HUD />
                </div>
                <button 
                    onClick={logout} // This button still works as intended
                    style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 101 }}
                >
                    Logout
                </button>
            </div>
        </ChatProvider>
    );
}

export default Metaverse;