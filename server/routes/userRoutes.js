import express from 'express';
import jwtAuthMiddleware from '../middleware/auth.js';
import checkAdmin from '../middleware/admin.js';
import { upload } from '../config/cloudinary.js';
import {
    getAllUsers,
    updateUserRole,
    getMetaverseUsers,
    updateProfile
} from '../controllers/userController.js';

const router = express.Router();

// 👑 ADMIN Routes
router.get('/all', jwtAuthMiddleware, checkAdmin, getAllUsers);
router.put('/:id/role', jwtAuthMiddleware, checkAdmin, updateUserRole);

// User Routes
router.get('/', jwtAuthMiddleware, getMetaverseUsers);
router.put('/update-profile', jwtAuthMiddleware, upload.single('avatar'), updateProfile);

export default router;
