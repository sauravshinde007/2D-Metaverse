import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getStreamToken } from "../controllers/streamController.js";

const router = express.Router();

router.get("/get-token", authMiddleware, getStreamToken);

export default router;
