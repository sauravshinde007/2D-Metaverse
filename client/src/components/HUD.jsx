// components/HUD.jsx
import { useEffect, useState, useRef } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
  Thread,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

const apiKey = import.meta.env.VITE_STREAM_API_KEY;
const socketServerUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

export default function HUD() {
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatFocused, setChatFocused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const client = StreamChat.getInstance(apiKey);

    async function init() {
      if (client.userID) {
        setChatClient(client);
        return;
      }

      const userId = "user_" + Math.floor(Math.random() * 1000);
      const res = await fetch(`${socketServerUrl}/get-token/${userId}`);
      const data = await res.json();

      await client.connectUser({ id: userId, name: userId }, data.token);

      const channel = client.channel("messaging", "metaverse-room", {
        name: "Metaverse Lobby",
        members: [userId],
      });

      await channel.watch({ presence: true });

      updateOnlineCount(channel);

      setChatClient(client);
      setChannel(channel);
    }

    init();

    return () => {
      client.disconnectUser();
    };
  }, []);

  const updateOnlineCount = (channel) => {
    const members = Object.values(channel.state.members || {});
    const online = members.filter((m) => m.user?.online);
    setOnlineCount(online.length);
  };

  // Handle chat focus and click outside detection
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatContainerRef.current && !chatContainerRef.current.contains(event.target)) {
        if (chatFocused) {
          setChatFocused(false);
          window.dispatchEvent(new CustomEvent('chat-focus-change', {
            detail: { focused: false }
          }));
        }
      }
    };

    const handleChatClick = (e) => {
      if (!chatFocused && chatContainerRef.current && chatContainerRef.current.contains(e.target)) {
        setChatFocused(true);
        window.dispatchEvent(new CustomEvent('chat-focus-change', {
          detail: { focused: true }
        }));
      }
    };

    const handleInputFocus = () => {
      if (!chatFocused) {
        setChatFocused(true);
        window.dispatchEvent(new CustomEvent('chat-focus-change', {
          detail: { focused: true }
        }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('click', handleChatClick);
    }

    const inputCheckInterval = setInterval(() => {
      const chatInputs = document.querySelectorAll(
        ".str-chat__textarea textarea, .str-chat__input--textarea textarea, input[type='text']"
      );
      
      chatInputs.forEach((input) => {
        if (!input.hasFocusListeners) {
          input.addEventListener('focus', handleInputFocus);
          input.hasFocusListeners = true;
        }
      });
    }, 500);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      
      if (chatContainer) {
        chatContainer.removeEventListener('click', handleChatClick);
      }
      
      clearInterval(inputCheckInterval);
      
      const chatInputs = document.querySelectorAll(
        ".str-chat__textarea textarea, .str-chat__input--textarea textarea, input[type='text']"
      );
      
      chatInputs.forEach((input) => {
        input.removeEventListener('focus', handleInputFocus);
        input.hasFocusListeners = false;
      });
    };
  }, [chatFocused]);

  const toggleMinimize = (e) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
    if (!isMinimized) {
      setChatFocused(false);
      window.dispatchEvent(new CustomEvent('chat-focus-change', {
        detail: { focused: false }
      }));
    }
  };

  if (!chatClient || !channel) {
    return (
      <div className="absolute bottom-4 right-4 w-[400px] h-[56px] rounded-lg shadow-xl bg-white flex items-center justify-center text-gray-500 border border-gray-200" style={{ zIndex: 100 }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chatContainerRef}
      className="absolute bottom-4 right-4 w-[400px] rounded-lg shadow-2xl bg-white border border-gray-200 transition-all duration-300 ease-in-out"
      style={{ 
        height: isMinimized ? '56px' : '600px',
        zIndex: 100,
      }}
    >
      {/* Custom Header - ALWAYS VISIBLE */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-white flex-shrink-0 rounded-t-lg"
        style={{ 
          height: '56px',
          borderBottom: isMinimized ? 'none' : '1px solid #E5E7EB',
          position: 'relative',
          zIndex: 10000,
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-black">Chatting</h3>
          <span className="text-xs text-gray-500">• {onlineCount} online</span>
        </div>

        {/* Minimize/Maximize Button */}
        <button
          onClick={toggleMinimize}
          className="w-8 h-8 rounded-md hover:bg-gray-100 transition-colors duration-200 flex items-center justify-center text-gray-500 hover:text-gray-700"
          title={isMinimized ? "Maximize" : "Minimize"}
        >
          {isMinimized ? (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M5 15l7-7 7 7" 
              />
            </svg>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          )}
        </button>
      </div>

      {/* Chat Body Container - Hidden when minimized */}
      {!isMinimized && (
        <>
          {/* Focus Indicator */}
          {chatFocused && (
            <div 
              className="bg-indigo-600 text-white text-xs px-3 py-2 text-center animate-slide-down"
              style={{ 
                borderTop: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              💬 Chat focused • Click outside to exit
            </div>
          )}

          {/* Stream Chat Container */}
          <div 
            style={{ 
              height: chatFocused ? 'calc(544px - 36px)' : '544px',
              overflow: 'hidden',
            }}
          >
            <Chat client={chatClient} theme="str-chat__theme-light">
              <Channel channel={channel}>
                <Window hideOnThread>
                  {/* Messages Area */}
                  <div 
                    className="bg-white overflow-y-auto custom-message-list" 
                    style={{ 
                      height: 'calc(100% - 70px)',
                    }}
                  >
                    <MessageList />
                  </div>

                  {/* Input Area */}
                  <div 
                    className="border-t border-gray-200 bg-white p-3 rounded-b-lg" 
                    style={{ height: '70px' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <MessageInput focus={chatFocused} />
                      </div>
                    </div>
                  </div>
                </Window>
                <Thread />
              </Channel>
            </Chat>
          </div>
        </>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .custom-message-list::-webkit-scrollbar {
          width: 6px;
        }

        .custom-message-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-message-list::-webkit-scrollbar-thumb {
          background: #CBD5E0;
          border-radius: 3px;
        }

        .custom-message-list::-webkit-scrollbar-thumb:hover {
          background: #A0AEC0;
        }

        .str-chat {
          height: 100% !important;
        }

        .str-chat__container {
          height: 100% !important;
        }

        .str-chat__main-panel {
          height: 100% !important;
        }

        .str-chat__list {
          height: 100% !important;
          overflow-y: auto !important;
          padding: 16px !important;
          background: white !important;
        }

        .str-chat__message-simple {
          margin-bottom: 12px !important;
        }

        .str-chat__message-simple-text-inner {
          background: #F7FAFC !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          font-size: 14px !important;
          color: #2D3748 !important;
        }

        .str-chat__message-simple--me .str-chat__message-simple-text-inner {
          background: #667EEA !important;
          border-color: #667EEA !important;
          color: white !important;
        }

        .str-chat__input-flat {
          background: #F7FAFC !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 20px !important;
          padding: 8px 16px !important;
        }

        .str-chat__input-flat:focus-within {
          border-color: #667EEA !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }

        .str-chat__textarea textarea {
          font-size: 14px !important;
          color: #2D3748 !important;
          padding: 0 !important;
        }

        .str-chat__textarea textarea::placeholder {
          color: #A0AEC0 !important;
        }

        .str-chat__message-simple-status {
          display: none !important;
        }

        .str-chat__send-button {
          display: none !important;
        }

        .str-chat__input-flat-emojiselect {
          display: none !important;
        }

        .str-chat__input-flat-wrapper {
          border: none !important;
          padding: 0 !important;
        }

        .str-chat__avatar {
          width: 32px !important;
          height: 32px !important;
          border-radius: 8px !important;
        }

        .str-chat__avatar-image {
          border-radius: 8px !important;
        }

        .str-chat__message-simple-name {
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #4A5568 !important;
          margin-bottom: 4px !important;
        }

        .str-chat__message-simple-timestamp {
          font-size: 11px !important;
          color: #A0AEC0 !important;
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }

        .str-chat__date-separator {
          margin: 16px 0 !important;
        }

        .str-chat__date-separator-line {
          background: #E2E8F0 !important;
        }

        .str-chat__date-separator-date {
          font-size: 11px !important;
          color: #718096 !important;
          background: white !important;
          padding: 0 8px !important;
        }

        .str-chat__channel-header {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
