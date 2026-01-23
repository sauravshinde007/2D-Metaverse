// server/api/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { StreamChat } from "stream-chat";
import User from "../models/User.js";
import crypto from "crypto"; // Native Node.js module for tokens

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
        const { username, email, password, role } = req.body;

        // Check for existing username OR email
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ message: "Username or Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ username, email, password: hashedPassword, role });
        await newUser.save();

        // Also create the user in Stream Chat
        await serverClient.upsertUser({ id: username, name: username, role });

        const token = jwt.sign({ userId: newUser.id, username: newUser.username, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, userId: newUser.id, username: newUser.username, role: newUser.role, email: newUser.email });

    } catch (error) {
        console.error("Error during signup:", error); // Add this line
        res.status(500).json({ message: "Something went wrong during signup." });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { username, password, force } = req.body; // 'username' field can contain username OR email

        // Find by username OR email
        const user = await User.findOne({
            $or: [{ username: username }, { email: username }]
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        // If user already has an active socket and this is NOT a forced login
        if (user.activeSocketId && !force) {
            return res.status(409).json({
                message: "You are already logged in on another device.",
                sessionActive: true,
            });
        }

        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, userId: user.id, username: user.username, role: user.role, email: user.email });

    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ message: "Something went wrong during login." });
    }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Security: Don't reveal if user exists or not, but for this project we might want to return 404 for clarity
            return res.status(404).json({ message: "No account with that email address exists." });
        }

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash it and set to user (good practice not to save raw token)
        // For simplicity in this project we'll just save it directly or lightly hashed
        // but let's just save it.
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // --- MOCK EMAIL SENDING ---
        // In a real SaaS, use Nodemailer/SendGrid here.
        // For now, we log the link to the console for the USER / Dev to click.
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

        console.log('============================================');
        console.log('📧 PASSWORD RESET REQUEST');
        console.log(`To: ${email}`);
        console.log(`Link: ${resetUrl}`);
        console.log('============================================');

        res.json({ message: "Password reset link sent to email (Check Server Console)." });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Find user with token and check expiry
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Password reset token is invalid or has expired." });
        }

        // Update password
        user.password = await bcrypt.hash(newPassword, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: "Password has been updated." });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;