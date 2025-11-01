import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Chat, Channel, Window, MessageList, MessageInput, ChannelList } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';

function PrivateChatManager() {
  const { chatClient } = useChat(); 
  const { token } = useAuth();
  const [isPrivateChatOpen, setIsPrivateChatOpen] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activePrivateChannel, setActivePrivateChannel] = useState(null);
  
  //const apiUrl = '/api/users'; 
  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${serverUrl}/api/users`, { 
        headers: {
          'Authorization': `Bearer ${token}` 
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch users (status: ${response.status})`);
      }

      const users = data;
      
      // Filter out the current user
      setUserList(users.filter(user => user.username !== chatClient.userID));
      
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
        // *** THIS IS THE FIX ***
        // We must use targetUser.username, because that is the ID
        // you registered in Stream. The error shows we are
        // sending the MongoDB ID (targetUser._id) by mistake.
        members: [chatClient.userID, targetUser.username],
      });
      await channel.watch();
      setActivePrivateChannel(channel); 
      setShowUserList(false); 
    } catch (err) {
      // This will catch the error and display it if needed
      console.error('Error starting private chat:', err);
    }
  };

  if (!chatClient) {
    return null; 
  }

  return (
    <>
      <button 
        className="chat-icon-button" 
        onClick={() => setIsPrivateChatOpen(true)}
        title="Open Private Chats"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm6-11a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      </button>

      {isPrivateChatOpen && (
        <Chat client={chatClient}>
          <div className="private-chat-modal">
            <div className="private-chat-sidebar">
              <div className="private-chat-header">
                <h4>Private Messages</h4>
                <button onClick={() => setIsPrivateChatOpen(false)}>&times;</button>
              </div>
              
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
            </div>

            <div className="private-chat-window">
              <Channel channel={activePrivateChannel}>
                <Window>
                  <MessageList />
                  <MessageInput />
                </Window>
              </Channel>
            </div>
          </div>
        </Chat>
      )}

      {showUserList && (
        <div className="user-list-modal">
          <div className="user-list-header">
            <h4>Start a conversation</h4>
            <button onClick={() => setShowUserList(false)}>&times;</button>
          </div>
          {loading && <div>Loading users...</div>}
          {error && <div className="error-text">Error: {error}</div>} 
          <ul className="user-list-body">
            {userList.length > 0 ? (
              userList.map((user) => (
                // Use the username as the key (it's unique)
                <li key={user.username} onClick={() => startPrivateChat(user)}>
                  {user.username}
                </li>
              ))
            ) : (
              !loading && !error && <li>No users found</li>
            )}
          </ul>
        </div>
      )}

      <style>{`
        .str-chat__message-text {
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        .new-chat-button {
          width: 100%;
          background-color: #505081;
          color: white;
          border: 1px solid #8686AC;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .new-chat-button:hover {
          background-color: #8686AC;
        }

        .private-chat-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 800px;
          max-width: 90vw;
          height: 600px;
          max-height: 80vh;
          background-color: #272757;
          border-radius: 8px;
          border: 1px solid #505081;
          box-shadow: 0 8px 24px rgba(15, 14, 71, 0.8);
          z-index: 1000;
          display: flex;
          color: #E0E0E0;
        }

        .private-chat-modal .str-chat__theme-dark,
        .private-chat-modal .str-chat__theme-light {
          --str-chat__primary-color: transparent;
          --str-chat__bg-color: transparent;
          --str-chat__channel-list-bg-color: transparent;
          --str-chat__active-channel-bg-color: transparent;
          --str-chat__hover-channel-bg-color: transparent;
        }

        .private-chat-sidebar {
          width: 240px;
          background: #0F0E47;
          border-radius: 8px 0 0 8px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #505081;
        }

        .private-chat-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #505081;
          flex-shrink: 0;
        }
        .private-chat-header h4 { 
          margin: 0; 
          font-weight: 600;
          color: #ffffff;
        }
        .private-chat-header button {
          background: none; border: none; color: #8686AC;
          font-size: 24px; cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .private-chat-header button:hover {
          color: #ffffff;
        }

        .private-chat-sidebar .str-chat__channel-list-team {
          flex: 1;
          height: auto;
          overflow-y: auto;
        }

        .private-chat-sidebar .str-chat__channel-preview-messenger {
          padding: 12px 16px !important;
          border-top: 1px solid #505081;
          background: transparent !important;
        }
        .private-chat-sidebar .str-chat__channel-preview-messenger--active {
          background: #272757 !important;
        }
        .private-chat-sidebar .str-chat__channel-preview-messenger:hover {
          background: #505081 !important;
        }

        .private-chat-sidebar .str-chat__channel-preview-title {
          color: #E0E0E0;
          font-weight: 500;
        }
        .private-chat-sidebar .str-chat__channel-preview-message {
          color: #8686AC;
        }
        .private-chat-sidebar .str-chat__avatar {
          background-color: #505081;
        }
        
        .private-chat-window {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: #272757;
        }
        .private-chat-window .str-chat__main-panel {
          height: 100%;
          border-radius: 0 8px 8px 0;
          background-color: #272757;
        }
        .private-chat-window .str-chat__list {
          background-color: #272757;
        }
        .private-chat-window .str-chat__message-simple {
          background-color: transparent !important;
        }
        .private-chat-window .str-chat__message-simple:hover {
          background-color: rgba(15, 14, 71, 0.5) !important;
        }
        .private-chat-window .str-chat__message-sender-name {
          color: #ffffff;
        }
        .private-chat-window .str-chat__message-simple-text {
          color: #8686AC;
        }

        .private-chat-window .str-chat__input-flat {
          background-color: #272757 !important;
          border: none !important;
          padding: 0 !important;
        }
        .private-chat-window .str-chat__input-flat-wrapper {
          background-color: #0F0E47 !important;
          border: 1px solid #505081 !important;
          border-radius: 8px !important;
          margin: 16px !important;
        }
        .private-chat-window .str-chat__input-flat-wrapper:focus-within {
          border-color: #8686AC !important;
        }
        .private-chat-window .str-chat__textarea textarea {
          color: #ffffff !important;
          background-color: #0F0E47 !important;
          padding: 11px 16px !important;
        }
        .private-chat-window .str-chat__textarea textarea::placeholder {
          color: #8686AC !important;
        }

        .private-chat-window .str-chat__channel-header,
        .private-chat-window .str-chat__input-flat-emojiselect,
        .private-chat-window .str-chat__send-button,
        .private-chat-window .str-chat__message-simple-status {
          display: none !important;
        }
        
        .user-list-modal {
          position: fixed; 
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          background: #272757;
          border: 1px solid #505081;
          border-radius: 8px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          z-index: 1001;
          color: #E0E0E0;
          display: flex;
          flex-direction: column;
        }
        .user-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #505081;
          background-color: #0F0E47;
        }
        .user-list-header h4 { margin: 0; font-size: 16px; color: #fff; }
        .user-list-header button {
          background: none; border: none; color: #8686AC;
          font-size: 24px; cursor: pointer; padding: 0; line-height: 1;
        }
        .user-list-body {
          list-style: none; padding: 8px; margin: 0;
          max-height: 300px; overflow-y: auto;
        }
        .user-list-body li {
          padding: 10px 12px; cursor: pointer;
          border-radius: 4px; font-weight: 500;
        }
        .user-list-body li:hover { background-color: #505081; }
        .error-text { color: #F04747; padding: 12px 16px; font-weight: 500; }
      `}</style>
    </>
  );
}

export default PrivateChatManager;

