// server/api/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { StreamChat } from "stream-chat";
import User from "../models/User.js";

console.log('--- In api/auth.js ---');
console.log('STREAM_API_KEY:', process.env.STREAM_API_KEY);
console.log('STREAM_API_SECRET:', process.env.STREAM_API_SECRET ? 'Loaded' : 'NOT LOADED');
console.log('----------------------');

const router = express.Router();

const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
);

// SIGNUP
router.post("/signup", async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();

        // Also create the user in Stream Chat
        await serverClient.upsertUser({ id: username, name: username, role });

        const token = jwt.sign({ userId: newUser.id, username: newUser.username, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, userId: newUser.id, username: newUser.username, role: newUser.role });

    } catch (error) {
        console.error("Error during signup:", error); // Add this line
        res.status(500).json({ message: "Something went wrong during signup." });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, userId: user.id, username: user.username, role: user.role });

    } catch (error) {
        res.status(500).json({ message: "Something went wrong during login." });
    }
});

export default router;