// client/src/context/ChatContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { StreamChat } from 'stream-chat';
import { useAuth } from './AuthContext'; // Import useAuth

const apiKey = import.meta.env.VITE_STREAM_API_KEY;
const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const { user, token } = useAuth(); // Get authenticated user and JWT

    useEffect(() => {
        if (!user || !token) return;

        const client = StreamChat.getInstance(apiKey);

        const initChat = async () => {
            try {
                if (client.userID !== user.username) {
                    if (client.userID) {
                        await client.disconnectUser();
                    }
                    const res = await fetch(`${serverUrl}/api/stream/get-token`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    await client.connectUser(
                        { id: user.username, name: user.username, role: user.role },
                        data.token
                    );
                }
                
                const mainChannel = client.channel("messaging", "metaverse-room", { name: "Metaverse Lobby" });
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
        
    }, [user, token]);

    return (
        <ChatContext.Provider value={{ chatClient, channel, isConnecting }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);