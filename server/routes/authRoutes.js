import express from "express";
import passport from "passport";
import jwtAuthMiddleware from "../middleware/auth.js";
import {
    signup,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    googleCallback
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", jwtAuthMiddleware, getMe);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    googleCallback
);

export default router;
