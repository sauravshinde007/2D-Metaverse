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

const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies
const server = http.createServer(app);

// --- PeerJS Server Setup ---
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
  allow_discovery: true,
});

app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`✅ PeerJS client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`❌ PeerJS client disconnected: ${client.getId()}`);
});

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = 3001;

// --- API Routes ---
app.use("/api/auth", authRoutes); // Authentication routes (signup/login)
app.use("/api/stream", streamApiRoutes); // Stream Chat related routes

// --- Socket.IO Connection Handling ---
socketHandler(io);

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});