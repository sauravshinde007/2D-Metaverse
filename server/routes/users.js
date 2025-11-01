import express from 'express';
import User from '../models/User.js';
import jwtAuthMiddleware from '../middleware/auth.js';
import mongoose from 'mongoose'; 

const router = express.Router();

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

export default router;
