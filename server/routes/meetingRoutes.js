import express from "express";
import axios from "axios";
import authMiddleware from "../middleware/auth.js";
import MeetingRecord from "../models/MeetingRecord.js";
import MeetingTranscript from "../models/MeetingTranscript.js";
import { addMomJob } from "../services/momQueue.js";
import multer from "multer";
import os from "os";
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";

const upload = multer({ dest: os.tmpdir() });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'devkey' });


const router = express.Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";

// ================================
// Create / Get Meeting Room
// ================================
// ================================
// Create / Get Meeting Token
// ================================

import { AccessToken } from 'livekit-server-sdk';

router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.body;
        const participantName = req.userData.username;

        if (!roomId) {
            return res.status(400).json({
                error: "roomId is required",
            });
        }

        // Unique room name
        const livekitRoomName = `meta-${roomId}`;

        // Create a new token for the participant
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantName,
        });

        at.addGrant({ roomJoin: true, room: livekitRoomName });
        const token = await at.toJwt();

        return res.json({
            token: token,
            url: LIVEKIT_URL,
            roomName: livekitRoomName,
        });
    } catch (error) {
        console.error("LiveKit error:", error.message);

        return res.status(500).json({
            error: "Failed to create meeting token",
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
// Transcribe Audio
// ================================

router.post("/transcribe", authMiddleware, upload.single('audioFile'), async (req, res) => {
    try {
        const { sessionId } = req.body;
        const username = req.userData.username;

        if (!req.file || !sessionId) {
            return res.status(400).json({ error: "Missing audio or sessionId" });
        }

        const meetingsDir = path.join(os.tmpdir(), "metaverse_meetings");
        if (!fs.existsSync(meetingsDir)) {
            fs.mkdirSync(meetingsDir, { recursive: true });
        }

        // We store an appended webm file PER USER per session. 
        // This naturally merges the continuous WebM chunks into a single valid file stream.
        const safeUsername = username.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const targetPath = path.join(meetingsDir, `${sessionId}_${safeUsername}.webm`);

        const chunkData = fs.readFileSync(req.file.path);
        fs.appendFileSync(targetPath, chunkData);

        // Delete the multer temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        return res.json({ success: true, message: "Audio chunk stored." });
    } catch (e) {
        console.error("Audio chunk append error:", e);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: "Audio append failed" });
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
            return res.json({ message: "MOM is already generated or generating", status: record.momStatus });
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
