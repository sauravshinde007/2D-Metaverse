import express from 'express';
import User from '../models/User.js';
import jwtAuthMiddleware from '../middleware/auth.js';
import checkAdmin from '../middleware/admin.js';
import mongoose from 'mongoose';
import { ROLES } from '../config/roles.js';

const router = express.Router();

// 👑 ADMIN: Get all users with their roles
router.get('/all', jwtAuthMiddleware, checkAdmin, async (req, res) => {
    try {
        // Return username, email, role, _id
        const users = await User.find({}, 'username email role _id');
        res.json(users);
    } catch (err) {
        console.error("Admin fetch users error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// 👑 ADMIN: Update user role
router.put('/:id/role', jwtAuthMiddleware, checkAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = Object.values(ROLES);

        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.role = role;
        await user.save();

        res.json({ message: `User role updated to ${role}`, user });
    } catch (err) {
        console.error("Admin update role error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/', jwtAuthMiddleware, async (req, res) => {
    try {
        const { userId } = req.userData;

        if (!userId) {
            return res.status(400).json({ message: 'User ID not found in token.' });
        }

        let currentUserId;
        try {
            currentUserId = new mongoose.Types.ObjectId(userId);
        } catch (castError) {
            console.error("Failed to cast userId:", userId, castError.message);
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }

        // *** THIS IS THE FIX: ***
        // We must explicitly select both '_id' and 'username'.
        // .select('username') was not sending the _id, which caused the 'key' prop error.
        const users = await User.find({ _id: { $ne: currentUserId } })
            .select('_id username'); // Now it will send [{ _id: "...", username: "..." }]

        if (!users) {
            return res.status(404).json({ msg: 'No users found' });
        }

        res.json(users);

    } catch (err) {
        console.error("Error in /api/users route:", err.message);
        res.status(500).json({ message: err.message || 'Server error while fetching users.' });
    }
});

// Update Email Route
// Update Profile Route (Email & Username)
router.put('/update-profile', jwtAuthMiddleware, async (req, res) => {
    try {
        const { userId } = req.userData;
        const { email, username } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 1. Check Email Uniqueness provided it changed
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail && existingEmail._id.toString() !== userId) {
                return res.status(400).json({ message: 'Email already in use.' });
            }
            user.email = email;
        }

        // 2. Check Username Uniqueness provided it changed
        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername && existingUsername._id.toString() !== userId) {
                return res.status(400).json({ message: 'Username already taken.' });
            }
            user.username = username;
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully.',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: 'Server error updating profile.' });
    }
});

export default router;
