// client/src/context/ChatContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { StreamChat } from 'stream-chat';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext'; // ✨ Import notification context

const apiKey = import.meta.env.VITE_STREAM_API_KEY;
const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [unreadCounts, setUnreadCounts] = useState({ world: 0, private: 0 });
    const { user, token, logout } = useAuth();
    const { addNotification } = useNotification(); // ✨ Get the notification function

    useEffect(() => {
        // This is the main connection and cleanup logic
        let client;
        let didAbort = false;

        const initChat = async () => {
            if (!user || !token) {
                setIsConnecting(false);
                return;
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
                    if (response.status === 401) {
                        // Unauthorized, likely due to invalid/expired token
                        console.warn('🔒 Unauthorized from /api/stream/get-token, logging out.');
                        logout();
                    }
                    throw new Error(`Failed to get Stream token: ${response.statusText}`);
                }

                const data = await response.json();

                // Robust ID selection:
                const streamRole = user.role === 'admin' ? 'admin' : 'user';
                const streamDetails = {
                    id: user.userId || user._id || user.id, // <--- CHANGED: Prioritize ID
                    name: user.username,
                    role: streamRole,
                    metaverse_role: user.role,
                    image: user.avatar // optional
                };

                // Connect the user to Stream
                await client.connectUser(streamDetails, data.token);

                if (didAbort) return;

                // Get and watch the main channel
                const mainChannel = client.channel("messaging", "global-lobby", { name: "Global Lobby" });
                await mainChannel.watch();

                setChatClient(client);
                setChannel(mainChannel);

                // Event listener for new messages
                client.on('message.new', (event) => {
                    // Ignore own messages
                    if (event.user.id === client.userID) return;

                    if (event.channel_id === 'global-lobby') {
                        setUnreadCounts(prev => ({ ...prev, world: prev.world + 1 }));
                        // ✨ Add World Chat Notification
                        addNotification(`New message in World Chat`, 'info');
                    } else {
                        setUnreadCounts(prev => ({ ...prev, private: prev.private + 1 }));
                        // ✨ Add Private Chat Notification
                        addNotification(`New private message from ${event.user.name || event.user.id}`, 'info');
                    }
                });

                // Also listen for notifications (when added to new channel etc)
                client.on('notification.message_new', (event) => {
                    // Similar logic if needed, but message.new covers active connection events
                });

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
    }, [user, token, addNotification]); // Added addNotification dependence

    const markAsRead = (type) => {
        setUnreadCounts(prev => ({ ...prev, [type]: 0 }));
    };

    return (
        <ChatContext.Provider value={{ chatClient, channel, isConnecting, unreadCounts, markAsRead }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);