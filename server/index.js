import express from "express";
import http from "http";
import { Server } from "socket.io";
import { StreamChat } from "stream-chat";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // Add this line here

const app = express();
app.use(cors()); // ✅ allow cross-origin requests
const server = http.createServer(app);

//api key and secret for stream chat
const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
);

const io = new Server(server, {
  cors: { origin: "*" }, // allow frontend dev
});

const PORT = 3001;

let players = {}; // store connected players

app.get("/get-token/:userId", async (req, res) => {
  const { userId } = req.params;
  const token = serverClient.createToken(userId);

  // Ensure user exists
  await serverClient.upsertUser({ id: userId, name: userId });

  // Ensure channel exists and add this user as a member
  const channel = serverClient.channel("messaging", "metaverse-room", {
    name: "Metaverse Lobby",
  });
  await channel.create();
  
  await channel.addMembers([userId]);

  res.json({ token });
});

app.get("/truncate", async (req, res) => {
  try {
    const channel = serverClient.channel("messaging", "metaverse-room");
    await channel.truncate(); // clears all messages
    res.json({ success: true, message: "Chat history cleared!" });
  } catch (err) {
    console.error("Error truncating channel:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // add new player with default animation state
  players[socket.id] = { 
    x: 400, 
    y: 300,
    anim: "idle-down" // Add default animation
  };
  
  // Send all existing players to the new player
  socket.emit("players", players);
  
  // Notify other players about the new player
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    ...players[socket.id]
  });

  // movement updates with animation
  socket.on("move", (data) => {
    if (players[socket.id]) {
      // Update player position and animation
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].anim = data.anim; // Store animation state
      
      // Broadcast position AND animation to other players
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        pos: { x: data.x, y: data.y },
        anim: data.anim // Include animation data
      });
    }
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(PORT, () => {
  console.log("✅ Server running on PORT " + PORT);
});
