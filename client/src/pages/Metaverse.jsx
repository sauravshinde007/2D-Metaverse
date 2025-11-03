// client/src/pages/Metaverse.jsx

import { useEffect } from "react";
import "../styles/App.css";
import startGame from "../phaser";
import HUD from "../components/HUD";
import VoiceChat from "../components/VoiceChat";
import { ChatProvider } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";

function Metaverse() {
    const { logout, user } = useAuth(); // We still need logout for the button

    useEffect(() => {
        if (user && user.username) {
            // Prevent duplicate initialization (React Strict Mode issue)
            if (window._phaserGame) {
                console.log('🎮 Phaser game already initialized, skipping...');
                return;
            }

            console.log('🎮 Initializing Phaser game for user:', user.username);
            const game = startGame(user.username);

            return () => {
                if (window._phaserGame) {
                    console.log('🎮 Cleaning up Phaser game...');
                    window._phaserGame.destroy(true);
                    window._phaserGame = null;
                }
            };
        }
    }, [user?.username]); // Only depend on username to prevent unnecessary re-renders

    return (
        <ChatProvider>
            <div className="app-root">
                <div id="game-container" className="game-container" />
                <div className="hud-root">
                    <HUD />
                </div>
                <VoiceChat />
                <button 
                    onClick={logout}
                    className="ui-button"
                >
                    Logout
                </button>
            </div>
        </ChatProvider>
    );
}

export default Metaverse;