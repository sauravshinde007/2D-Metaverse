import express from "express";
import axios from "axios";
import authMiddleware from "../middleware/auth.js";
import MeetingRecord from "../models/MeetingRecord.js";
import { addMomJob } from "../services/momQueue.js";

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

// ================================
// Track Meetings
// ================================

import crypto from "crypto";

router.post("/join", authMiddleware, async (req, res) => {
    try {
        const { roomName } = req.body;
        const userId = req.userData.userId;

        // Find an active meeting in this room (within the last 4 hours)
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const activeMeeting = await MeetingRecord.findOne({
            roomName: roomName,
            joinTime: { $gte: fourHoursAgo },
            leaveTime: { $exists: false } // Still inside the meeting
        }).sort({ joinTime: -1 });

        const sessionId = activeMeeting && activeMeeting.sessionId
            ? activeMeeting.sessionId
            : crypto.randomUUID();

        // Also check if they ALREADY have a record (in case of reconnection)
        let record = await MeetingRecord.findOne({
            user: userId,
            roomName: roomName,
            leaveTime: { $exists: false },
            joinTime: { $gte: fourHoursAgo }
        });

        if (!record) {
            record = new MeetingRecord({
                sessionId: sessionId,
                user: userId,
                roomName: roomName,
                joinTime: new Date()
            });
            await record.save();
        }

        return res.json({ recordId: record._id, sessionId: record.sessionId });
    } catch (error) {
        console.error("Meeting join error:", error);
        return res.status(500).json({ error: "Failed to record meeting join" });
    }
});

router.post("/leave", authMiddleware, async (req, res) => {
    try {
        const { recordId } = req.body;
        if (!recordId) return res.status(400).json({ error: "recordId is required" });

        const record = await MeetingRecord.findById(recordId);
        if (!record) return res.status(404).json({ error: "Meeting record not found" });

        if (!record.leaveTime) {
            record.leaveTime = new Date();
            // Store duration in seconds instead of milliseconds for readibility
            record.duration = Math.floor((record.leaveTime - record.joinTime) / 1000);
            await record.save();
        }

        return res.json({ message: "Meeting leave recorded", duration: record.duration });
    } catch (error) {
        console.error("Meeting leave error:", error);
        return res.status(500).json({ error: "Failed to record meeting leave" });
    }
});

router.get("/history", authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const history = await MeetingRecord.find({ user: userId }).sort({ joinTime: -1 });
        return res.json({ history });
    } catch (error) {
        console.error("Meeting history fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch meeting history" });
    }
});

// ================================
// Generate MOM
// ================================

router.post("/:recordId/generate-mom", authMiddleware, async (req, res) => {
    try {
        const { recordId } = req.params;
        const userId = req.userData.userId;

        const record = await MeetingRecord.findOne({ _id: recordId, user: userId });
        if (!record) return res.status(404).json({ error: "Meeting record not found" });

        if (record.momStatus === 'Generating' || record.momStatus === 'Generated') {
            return res.status(400).json({ error: "MOM is already generated or generating" });
        }

        const targetSessionId = record.sessionId;

        // Update all meeting records in this exact same session across ALL users!
        if (targetSessionId) {
            await MeetingRecord.updateMany(
                { sessionId: targetSessionId },
                { $set: { momStatus: 'Generating' } }
            );
        } else {
            record.momStatus = 'Generating';
            await record.save();
        }

        await addMomJob(record._id, record.roomName, targetSessionId);

        return res.json({ message: "MOM generation started", status: "Generating" });
    } catch (error) {
        console.error("MOM generation error:", error);
        return res.status(500).json({ error: "Failed to start MOM generation" });
    }
});

export default router;
