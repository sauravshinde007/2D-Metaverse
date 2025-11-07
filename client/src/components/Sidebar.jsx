// client/src/components/Sidebar.jsx

import { useState } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import WorldChat from "./WorldChat";
import PrivateChatManager from './PrivateChatManager';
import '../styles/ChatSidebar.css';

export default function Sidebar() {
    const { chatClient, channel, isConnecting } = useChat();
    const { logout } = useAuth();
    
    const [activePanel, setActivePanel] = useState(null);

    const togglePanel = (panelName) => {
        // ... (this function remains the same)
        const newPanel = activePanel === panelName ? null : panelName;
        setActivePanel(newPanel);

        if (!newPanel) {
            window.dispatchEvent(new CustomEvent("chat-focus-change", { detail: { focused: false } }));
        }
    };

    const handleWorldChatClose = () => {
        // ... (this function remains the same)
        setActivePanel(null);
        window.dispatchEvent(new CustomEvent("chat-focus-change", { detail: { focused: false } }));
    };

    // This function is still used by PrivateChatManager's close button
    const handlePrivateChatClose = () => {
        setActivePanel(null);
        window.dispatchEvent(new CustomEvent("chat-focus-change", { detail: { focused: false } }));
    };

    return (
        <>
            {/* The 72px icon bar remains unchanged */}
            <div className="chat-sidebar">
                {/* ... (all the icon buttons are still here) ... */}
                
                <div className="sidebar-top">
                    <button
                        className={`sidebar-icon-button ${activePanel === 'WORLD' ? 'active' : ''}`}
                        onClick={() => togglePanel('WORLD')}
                        title="World Chat"
                    >
                        {/* World Chat SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </button>

                    <button
                        className={`sidebar-icon-button ${activePanel === 'PRIVATE' ? 'active' : ''}`}
                        onClick={() => togglePanel('PRIVATE')}
                        title="Private Chats"
                    >
                        {/* Private Chat SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </button>
                </div>

                <div className="sidebar-bottom">
                    <button
                        className="sidebar-icon-button"
                        onClick={logout}
                        title="Logout"
                    >
                        {/* Logout Icon SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* This panel container still ONLY holds the World Chat */}
            <div className="chat-panel-container">
                {activePanel === 'WORLD' && (
                    <WorldChat
                        chatClient={chatClient}
                        channel={channel}
                        isConnecting={isConnecting}
                        onClose={handleWorldChatClose}
                    />
                )}
            </div>

            {/* ** THE MAIN CHANGE IS HERE **
              We replace the .modal-backdrop logic with this new container.
            */}
            {activePanel === 'PRIVATE' && (
                <div className="private-chat-fullscreen-container">
                    <PrivateChatManager onClose={handlePrivateChatClose} />
                </div>
            )}
        </>
    );
}