import serverClient from "../services/streamService.js";

export const getStreamToken = async (req, res) => {
    try {
        const { userId, username, role } = req.userData;

        // Map internal roles to Stream valid roles ('admin' or 'user')
        const streamRole = role === 'admin' ? 'admin' : 'user';

        await serverClient.upsertUser({
            id: userId,
            name: username,
            role: streamRole,       // 'admin' or 'user'
            metaverse_role: role    // Store real role in custom field
        });

        const token = serverClient.createToken(userId);

        // Connect to a fresh channel to avoid conflicts
        const channel = serverClient.channel("messaging", "global-lobby", {
            name: "Global Lobby",
            created_by_id: userId,
        });
        await channel.create();

        // Add member using the UserID
        await channel.addMembers([userId]);

        res.json({ token });
    } catch (error) {
        console.error("Error in /get-stream-token:", error);
        res.status(500).json({ message: "Could not get Stream token." });
    }
};
