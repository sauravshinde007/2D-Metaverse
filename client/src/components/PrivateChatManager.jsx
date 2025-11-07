import React, { useState, useEffect, useRef } from 'react'; // 1. IMPORT useEffect and useRef
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Chat, Channel, Window, MessageList, MessageInput, ChannelList } from 'stream-chat-react';

import 'stream-chat-react/dist/css/v2/index.css';
import '../styles/PrivateChatManager.css'; 

export default function PrivateChatManager({ onClose }) {
  const { chatClient } = useChat(); 
  const { token } = useAuth();
  const [showUserList, setShowUserList] = useState(false);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activePrivateChannel, setActivePrivateChannel] = useState(null);
  
  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

  // 2. ADD THE REFS AND STATE FOR FOCUS HANDLING
  const chatContainerRef = useRef(null);
  const [chatFocused, setChatFocused] = useState(false);
  const chatFocusedRef = useRef(chatFocused);

  useEffect(() => {
    chatFocusedRef.current = chatFocused;
  }, [chatFocused]);

  // 3. ADD THE FOCUS-HANDLING LOGIC FROM WORLDCHAT
  // Effect for managing chat focus to avoid interfering with game controls
  useEffect(() => {
    const dispatchFocusChange = (isFocused) => {
        if (chatFocusedRef.current === isFocused) return;
        setChatFocused(isFocused);
        window.dispatchEvent(
            new CustomEvent("chat-focus-change", { detail: { focused: isFocused } })
        );
    };

    const handleClickOutside = (event) => {
        if (chatContainerRef.current && !chatContainerRef.current.contains(event.target)) {
            // Check if the click is on the sidebar button itself, if so, don't blur
            const sidebarButton = document.querySelector('.sidebar-icon-button[title="Private Chats"]');
            if (sidebarButton && sidebarButton.contains(event.target)) {
                return;
            }

            if (chatFocusedRef.current) {
                dispatchFocusChange(false);
                const chatInput = chatContainerRef.current.querySelector("textarea");
                if (chatInput) chatInput.blur();
            }
        }
    };

    const handleInputFocus = (e) => {
        // Only trigger if the focus is on a textarea *inside this component*
        if (e.target.tagName === 'TEXTAREA' && chatContainerRef.current?.contains(e.target)) {
            dispatchFocusChange(true);
        }
    };

    const handleInputBlur = (e) => {
        // Only trigger if the blur is from a textarea *inside this component*
        if (e.target.tagName === 'TEXTAREA' && chatContainerRef.current?.contains(e.target)) {
            setTimeout(() => {
                const activeElement = document.activeElement;
                const isInChat = chatContainerRef.current?.contains(activeElement);
                if (!isInChat || activeElement.tagName !== 'TEXTAREA') {
                    dispatchFocusChange(false);
                }
            }, 100);
        }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("focusin", handleInputFocus);
    document.addEventListener("focusout", handleInputBlur);

    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("focusin", handleInputFocus);
        document.removeEventListener("focusout", handleInputBlur);
        // When component unmounts, ensure focus is returned to game
        dispatchFocusChange(false);
    };
  }, []); // Empty dependency array: runs on mount, cleans up on unmount


  // --- All your other functions (fetchUsers, toggleUserList, etc.) remain unchanged ---
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${serverUrl}/api/users`, { 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch users (status: ${response.status})`);
      }
      setUserList(data.filter(user => user.username !== chatClient.userID));
    } catch (err) {
      if (err.name === 'SyntaxError') {
        setError('Received non-JSON response. Is proxy running?');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleUserList = () => {
    const newState = !showUserList;
    setShowUserList(newState);
    if (newState && userList.length === 0) {
      fetchUsers();
    }
  };

  const startPrivateChat = async (targetUser) => {
    try {
      const channel = chatClient.channel('messaging', {
        members: [chatClient.userID, targetUser.username],
      });
      await channel.watch();
      setActivePrivateChannel(channel); 
      setShowUserList(false); // Switch back to the channel list
    } catch (err) {
      console.error('Error starting private chat:', err);
    }
  };

  if (!chatClient) {
    return null; 
  }

  return (
    <>
      <Chat client={chatClient} theme="dark">
        {/* 4. ATTACH THE REF to the main container */}
        <div ref={chatContainerRef} className="private-chat-panel"> 
          <div className="private-chat-sidebar">
            
            <div className="private-chat-header">
              {showUserList && (
                <button onClick={() => setShowUserList(false)} className="back-button" title="Back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                  </svg>
                </button>
              )}
              <h4>{showUserList ? "Start a Chat" : "Private Messages"}</h4>
              <button onClick={onClose} title="Close Panel">&times;</button>
            </div>
            
            {showUserList ? (
              <div className="user-list-container">
                {loading && <div className="list-info-text">Loading users...</div>}
                {error && <div className="error-text">Error: {error}</div>} 
                <ul className="user-list-body">
                  {userList.length > 0 ? (
                    userList.map((user) => (
                      <li key={user.username} onClick={() => startPrivateChat(user)}>
                        {user.username}
                      </li>
                    ))
                  ) : (
                    !loading && !error && <li className="list-info-text">No users found</li>
                  )}
                </ul>
              </div>
            ) : (
              <>
                <ChannelList 
                  filters={{ 
                    type: 'messaging', 
                    members: { $in: [chatClient.userID] },
                    member_count: 2
                  }}
                  sort={{ last_message_at: -1 }}
                  onSelect={(channel) => setActivePrivateChannel(channel)}
                />
                <div style={{ padding: '8px' }}>
                  <button onClick={toggleUserList} className="new-chat-button">
                    + New Private Chat
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="private-chat-window">
            <Channel channel={activePrivateChannel}>
              <Window>
                <MessageList />
                {/* 5. PASS THE FOCUS PROP to MessageInput */}
                <MessageInput focus={chatFocused} />
              </Window>
            </Channel>
          </div>
        </div>
      </Chat>
    </>
  );
}