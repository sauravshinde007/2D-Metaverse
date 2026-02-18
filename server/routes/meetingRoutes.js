import express from "express";
import axios from "axios";

const router = express.Router();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_BASE_URL = "https://api.daily.co/v1";

// ================================
// Create / Get Meeting Room
// ================================
// ================================
// Configure Daily Domain (Run Once)
// ================================
router.post("/config-domain", async (req, res) => {
    try {
        const response = await axios.patch(
            `${DAILY_BASE_URL}/domain`,
            {
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    enable_prejoin_ui: true,
                    start_audio_off: false,
                    start_video_off: false,
                    eject_at_room_exp: true,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${DAILY_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error("Domain config error:", error.response?.data);

        res.status(500).json({
            error: "Failed to configure domain",
        });
    }
});

router.post("/create", async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                error: "roomId is required",
            });
        }

        // Unique room name
        const dailyRoomName = `meta-${roomId}`;

        // Try getting existing room
        let room;

        try {
            const existing = await axios.get(
                `${DAILY_BASE_URL}/rooms/${dailyRoomName}`,
                {
                    headers: {
                        Authorization: `Bearer ${DAILY_API_KEY}`,
                    },
                }
            );

            room = existing.data;

            console.log("Reusing room:", dailyRoomName);
        } catch (err) {
            // If not found → create new
            console.log("Creating new room:", dailyRoomName);

            const created = await axios.post(
                `${DAILY_BASE_URL}/rooms`,
                {
                    name: dailyRoomName,
                    properties: {
                        enable_chat: true,
                        enable_screenshare: true,
                        start_audio_off: false,
                        start_video_off: false,
                        max_participants: 4, // Added based on requirement: "at max only 4 people can join"
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${DAILY_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            room = created.data;
        }

        return res.json({
            url: room.url,
            roomName: room.name,
        });
    } catch (error) {
        console.error("Daily error:", error.response?.data || error.message);

        return res.status(500).json({
            error: "Failed to create meeting",
        });
    }
});

export default router;
