// server/api/stream.js
import express from "express";
import { StreamChat } from "stream-chat";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

const serverClient = StreamChat.getInstance(streamApiKey, streamApiSecret);

router.get("/get-token", authMiddleware, async (req, res) => {
    try {
        const { userId, username, role } = req.userData; // userId is immutable

        // ✅ Robustness Fix: Use userId (MongoID) as the Stream Chat ID.
        // This ensures that even if username changes, the chat identity/history remains.

        // ✅ Robustness Fix: Map internal roles to Stream valid roles ('admin' or 'user')
        // Stream Chat validates 'role' against its configured roles. 'employee', 'hr', 'ceo' are likely not defined.
        const streamRole = role === 'admin' ? 'admin' : 'user';

        await serverClient.upsertUser({
            id: userId,
            name: username,
            role: streamRole,       // 'admin' or 'user'
            metaverse_role: role    // Store real role in custom field
        });

        const token = serverClient.createToken(userId); // <--- CHANGED

        // Connect to a fresh channel to avoid conflicts with legacy username-based members
        const channel = serverClient.channel("messaging", "global-lobby", {
            name: "Global Lobby",
            created_by_id: userId, // <--- REQUIRED: Specify who is creating/accessing this channel since we are using server-side auth
        });
        await channel.create();

        // Add member using the UserID
        await channel.addMembers([userId]); // <--- CHANGED

        res.json({ token });
    } catch (error) {
        // ✅ ADDED: Better logging to help debug server-side issues.
        console.error("Error in /get-stream-token:", error);
        res.status(500).json({ message: "Could not get Stream token." });
    }
});

export default router;