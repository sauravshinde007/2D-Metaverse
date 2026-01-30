import { StreamChat } from "stream-chat";
import dotenv from "dotenv";
dotenv.config();

const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
);

export const syncUserToStream = async (user) => {
    try {
        const streamRole = user.role === 'admin' ? 'admin' : 'user';
        await serverClient.upsertUser({
            id: user._id.toString(),
            name: user.username,
            image: user.avatar || "",
            role: streamRole,
            metaverse_role: user.role
        });
        return true;
    } catch (error) {
        console.error("Failed to sync user to Stream Chat:", error);
        throw error;
    }
};

export const syncUsersBatch = async (users) => {
    if (!users || users.length === 0) return;

    const streamUsers = users.map(u => ({
        id: u._id.toString(),
        name: u.username,
        image: u.avatar || "",
        role: u.role === 'admin' ? 'admin' : 'user',
        metaverse_role: u.role
    }));

    try {
        await serverClient.upsertUsers(streamUsers);
        console.log(`✅ Synced ${users.length} users to Stream Chat`);
    } catch (error) {
        console.error("Failed to batch sync users to Stream Chat:", error);
        throw error;
    }
};

export default serverClient;
