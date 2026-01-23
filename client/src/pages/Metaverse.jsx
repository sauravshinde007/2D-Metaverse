// client/src/pages/Metaverse.jsx

import { useEffect, useState } from "react"; // <-- Import useState
import "../styles/App.css";
import startGame from "../phaser";
import Sidebar from "../components/Sidebar";
import VoiceChat from "../components/VoiceChat";
import VideoGrid from "../components/VideoGrid";
import LocalVideoView from "../components/LocalVideoView"; // <-- 1. Import LocalVideoView
import { ChatProvider } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";

function Metaverse() {
    const { user } = useAuth(); 
    // 2. "Lift state up" - Manage video state here
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);

    useEffect(() => {
        if (user && user.username) {
            const game = startGame(user.username);

            return () => {
                //if game already loadaed, destroy it on unmount
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
                {/* 3. Add LocalVideoView, controlled by the state */}
                <LocalVideoView isVisible={isVideoEnabled} />
                
                <VideoGrid />
                
                {/* 4. Pass the state and setter down to the controls */}
                <VoiceChat 
                  isVideoEnabled={isVideoEnabled}
                  setIsVideoEnabled={setIsVideoEnabled}
                />

                <Sidebar />
            </div>
        </ChatProvider>
    );
}

export default Metaverse;