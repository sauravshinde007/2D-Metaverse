// server/api/stream.js
import express from "express";
import { StreamChat } from "stream-chat";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
);

// This route is now protected
router.get("/get-token", authMiddleware, async (req, res) => {
    try {
        const { username } = req.userData; // Get username from decoded token
        const token = serverClient.createToken(username);

        const channel = serverClient.channel("messaging", "metaverse-room", {
            name: "Metaverse Lobby",
        });
        await channel.create();
        await channel.addMembers([username]);

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: "Could not get Stream token." });
    }
});

export default router;