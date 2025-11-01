// client/src/context/ChatContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { StreamChat } from 'stream-chat';
import { useAuth } from './AuthContext';

const apiKey = import.meta.env.VITE_STREAM_API_KEY;
const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const { user, token } = useAuth();

    useEffect(() => {
        // This is the main connection and cleanup logic
        let client;
        let didAbort = false;

        const initChat = async () => {
            if (!user || !token) {
                setIsConnecting(false);
                return; // Not ready to connect
            }

            setIsConnecting(true);
            client = StreamChat.getInstance(apiKey);

            try {
                // Fetch the user token from your backend
                const response = await fetch(`${serverUrl}/api/stream/get-token`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (didAbort) return;

                if (!response.ok) {
                    throw new Error(`Failed to get Stream token: ${response.statusText}`);
                }

                const data = await response.json();

                // Connect the user to Stream
                await client.connectUser(
                    { id: user.username, name: user.username, role: user.role },
                    data.token
                );
                
                if (didAbort) return;

                // Get and watch the main channel
                const mainChannel = client.channel("messaging", "metaverse-room", { name: "Metaverse Lobby" });
                await mainChannel.watch();

                setChatClient(client);
                setChannel(mainChannel);

            } catch (error) {
                console.error("Failed to initialize chat:", error);
                // On error, ensure we clear the state
                setChatClient(null);
                setChannel(null);
            } finally {
                if (!didAbort) {
                    setIsConnecting(false);
                }
            }
        };

        initChat();

        // Cleanup function
        return () => {
            didAbort = true;
            if (client) {
                client.disconnectUser();
            }
            setChatClient(null);
            setChannel(null);
            setIsConnecting(true);
        };
    }, [user, token]); // Rerun this entire effect if the user or token changes

    return (
        <ChatContext.Provider value={{ chatClient, channel, isConnecting }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);