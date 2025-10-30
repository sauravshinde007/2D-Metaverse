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
        const { username } = req.userData; // Get username from decoded JWT

        // ✅ BEST PRACTICE: Ensure the user exists on Stream before creating a token.
        // This prevents authentication issues on the client-side.
        // 'upsertUser' will create the user if they don't exist, or update them if they do.
        await serverClient.upsertUser({
            id: username,   // The ID must match the ID you use on the client
            name: username, // This is the display name in chat
            // You can add other fields here, like 'role' or 'image'
        });

        const token = serverClient.createToken(username);

        // This logic is fine, it ensures the channel exists and the user is a member.
        const channel = serverClient.channel("messaging", "metaverse-room", {
            name: "Metaverse Lobby",
        });
        await channel.create();
        await channel.addMembers([username]);

        res.json({ token });
    } catch (error) {
        // ✅ ADDED: Better logging to help debug server-side issues.
        console.error("Error in /get-stream-token:", error);
        res.status(500).json({ message: "Could not get Stream token." });
    }
});

export default router;