// src/context/ChatContext.jsx

import { createContext, useContext, useState, useEffect } from 'react';
import { StreamChat } from 'stream-chat';

const apiKey = import.meta.env.VITE_STREAM_API_KEY;
const socketServerUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const client = StreamChat.getInstance(apiKey);

    const initChat = async () => {
      if (client.userID) {
        setChatClient(client);
        // If we already have a client, we likely have a channel too.
        // This part can be enhanced if channel logic becomes more complex.
        if (client.activeChannels) {
            const mainChannel = Object.values(client.activeChannels).find(ch => ch.id === 'metaverse-room');
            if (mainChannel) setChannel(mainChannel);
        }
        setIsConnecting(false);
        return;
      }
      
      try {
        const userId = "user_" + Math.floor(Math.random() * 1000);
        const res = await fetch(`${socketServerUrl}/get-token/${userId}`);
        const data = await res.json();
        
        await client.connectUser({ id: userId, name: userId }, data.token);

        const mainChannel = client.channel("messaging", "metaverse-room", {
          name: "Metaverse Lobby",
        });

        await mainChannel.watch({ presence: true });

        setChatClient(client);
        setChannel(mainChannel);
      } catch (error) {
          console.error("Failed to initialize chat:", error);
      } finally {
          setIsConnecting(false);
      }
    };

    initChat();

    return () => {
      // Don't disconnect user on component unmount,
      // as it might be a simple re-render. 
      // Disconnection should be handled on window close or logout.
    };
  }, []);

  return (
    <ChatContext.Provider value={{ chatClient, channel, isConnecting }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);