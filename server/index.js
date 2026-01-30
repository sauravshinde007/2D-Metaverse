import dotenv from "dotenv";
dotenv.config();

console.log('--- In index.js ---');
console.log('STREAM_API_KEY:', process.env.STREAM_API_KEY);
console.log('STREAM_API_SECRET:', process.env.STREAM_API_SECRET ? 'Loaded' : 'NOT LOADED');
console.log('-------------------');

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import { ExpressPeerServer } from "peer";

// Import separated logic
import socketHandler from "./socket/socketHandler.js";
import authRoutes from "./api/auth.js";
import streamApiRoutes from "./api/stream.js";
import usersRoute from "./routes/users.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Passport
import passport from 'passport';
import configurePassport from './config/passport.js';
configurePassport();
app.use(passport.initialize());

const server = http.createServer(app);

// --- PeerJS Server Setup ---
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/",
  allow_discovery: true,
});
app.use("/peerjs", peerServer);

peerServer.on("connection", (client) => {
  console.log(`✅ PeerJS client connected: ${client.getId()}`);
});
peerServer.on("disconnect", (client) => {
  console.log(`❌ PeerJS client disconnected: ${client.getId()}`);
});

// --- Database Connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // --- SYNC USERS TO STREAM CHAT ON STARTUP ---
    try {
      const { StreamChat } = await import('stream-chat');
      const User = (await import('./models/User.js')).default;

      const serverClient = StreamChat.getInstance(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);
      const users = await User.find({});

      if (users.length > 0) {
        const streamUsers = users.map(u => ({
          id: u._id.toString(),
          name: u.username,
          image: u.avatar || "",
          role: u.role === 'admin' ? 'admin' : 'user',
          metaverse_role: u.role
        }));

        // Batch upsert is efficient
        await serverClient.upsertUsers(streamUsers);
        console.log(`✅ Synced ${users.length} users to Stream Chat (Fixed offline avatars)`);
      }
    } catch (err) {
      console.error("❌ Failed to sync users to Stream Chat on startup:", err);
    }

  })
  .catch((err) => console.error("MongoDB connection error:", err));

// --- Socket.IO ---
const io = new Server(server, { cors: { origin: "*" } });

// --- API Routes ---
app.use("/api/auth", authRoutes);        // Authentication routes (signup/login)
app.use("/api/stream", streamApiRoutes); // Stream Chat related routes
app.use("/api/users", usersRoute);       // Users routes

// --- Socket.IO Connection Handling ---
socketHandler(io);

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error("❌ Global Error Handler:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});
