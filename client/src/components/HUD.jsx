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

  // Handle chat focus
  useEffect(() => {
    const handleChatClick = (e) => {
      // Only focus if we're not already focused
      if (!chatFocused) {
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

    const handleInputBlur = () => {
      // Don't automatically blur when switching between chat inputs
      // Let the user explicitly click on the game to blur
    };

    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('click', handleChatClick);
    }

    // Set up interval to check for chat inputs
    const inputCheckInterval = setInterval(() => {
      const chatInputs = document.querySelectorAll(
        ".str-chat__textarea textarea, .str-chat__input--textarea textarea, input[type='text']"
      );
      
      chatInputs.forEach((input) => {
        if (!input.hasFocusListeners) {
          input.addEventListener('focus', handleInputFocus);
          input.addEventListener('blur', handleInputBlur);
          input.hasFocusListeners = true;
        }
      });
    }, 500);

    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('click', handleChatClick);
      }
      
      clearInterval(inputCheckInterval);
      
      // Clean up listeners
      const chatInputs = document.querySelectorAll(
        ".str-chat__textarea textarea, .str-chat__input--textarea textarea, input[type='text']"
      );
      
      chatInputs.forEach((input) => {
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
        input.hasFocusListeners = false;
      });
    };
  }, [chatFocused]);

  if (!chatClient || !channel) {
    return (
      <div className="absolute bottom-4 right-4 w-96 h-[500px] rounded-xl shadow-lg border bg-white/95 flex items-center justify-center text-gray-500">
        Connecting chat…
      </div>
    );
  }

  return (
    <div
      ref={chatContainerRef}
      className="absolute bottom-4 right-4 w-96 h-[500px] rounded-xl shadow-lg border bg-white/95 overflow-hidden flex flex-col transition-all duration-300"
      style={{ 
        zIndex: 100, // Higher z-index to ensure it's above the game overlay
        boxShadow: chatFocused ? '0 0 0 3px rgba(99, 102, 241, 0.5)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        transform: chatFocused ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      {/* Focus indicator */}
      {chatFocused && (
        <div className="absolute inset-0 border-2 border-indigo-500 rounded-xl pointer-events-none animate-pulse"></div>
      )}
      
      {/* Status message */}
      {chatFocused && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-md">
          Chat focused - Click game to return
        </div>
      )}
      
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            {/* Header with focus indicator */}
            <div 
              className="p-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold flex justify-between items-center transition-colors duration-300"
              style={{ 
                backgroundColor: chatFocused ? 'rgba(99, 102, 241, 0.9)' : '' 
              }}
            >
              <span className="flex items-center">
                💬 Metaverse Lobby 
                {chatFocused && <span className="ml-2 text-xs font-normal">(Focused)</span>}
              </span>
              <span className="text-sm">{onlineCount} online</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <MessageList />
            </div>

            {/* Input */}
            <div className="border-t bg-white">
              <MessageInput focus={chatFocused} />
            </div>
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
}