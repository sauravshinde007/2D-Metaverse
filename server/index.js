import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { socketManager } from "./src/socket/socketManager.js";
import { generateToken } from "./src/utils/streamchat.js";
import { serverClient } from "./src/utils/streamchat.js";
dotenv.config();
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3001;

// --- Generate token for client ---
app.get("/get-token/:userId", async (req, res) => {

  // Upsert user (admin action)
  
  await serverClient.upsertUser({ id: userId, name: userId });

  // Generate token
  const token = generateToken(userId);

  res.json({ token });
});

// Setup sockets

// ✅ Route: Truncate chat (clear all messages)
// app.get("/truncate", async (req, res) => {
//   try {
//     const channel = serverClient.channel("messaging", "metaverse-room");
//     await channel.truncate();
//     res.json({ success: true, message: "Chat history cleared!" });
//   } catch (err) {
//     console.error("Error truncating channel:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// ✅ Setup all socket handlers
socketManager(io);

server.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});
