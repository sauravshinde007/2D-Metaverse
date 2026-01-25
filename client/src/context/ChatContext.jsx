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
    const [unreadCounts, setUnreadCounts] = useState({ world: 0, private: 0 });
    const { user, token, logout } = useAuth();

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
                // Login returns 'userId', Update Profile returns '_id'. We must handle both.
                // Fallback to username only if absolutely necessary, but mismatch will cause error.
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
                    } else {
                        setUnreadCounts(prev => ({ ...prev, private: prev.private + 1 }));
                    }
                });

                // Also listen for notifications (when added to new channel etc)
                client.on('notification.message_new', (event) => {
                    // Check if it's already handled by message.new (if we are watching the channel)
                    // Usually notification.message_new comes for channels we aren't actively watching in the UI connection list yet?
                    // For safety, we can rely on message.new for watched channels.
                    // But for private chats we might not be watching all of them explicitly until we query.
                    // Simplified approach: message.new usually covers watched channels.
                    // If we are notified of a message in a channel we don't have open, it might still fire message.new if we are connected.
                });

                // Initial unread count fetch (optional, for simple MVP starting at 0 is fine, 
                // but fetching real counts is better)
                // const counts = await client.queryChannels(...) loops... let's keep it simple (session based) for now as requested.

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