// client/src/pages/Metaverse.jsx

import { useEffect } from "react";
import "../styles/App.css";
import startGame from "../phaser";
import Sidebar from "../components/Sidebar";
import VoiceChat from "../components/VoiceChat";
import { ChatProvider } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";

function Metaverse() {
    const { user } = useAuth(); // We still need logout for the button

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
                <Sidebar />
                <VoiceChat />
                
            </div>
        </ChatProvider>
    );
}

export default Metaverse;