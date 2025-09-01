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

const PORT = process.env.PORT || 3001;

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

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // add new player
  players[socket.id] = { x: 400, y: 300 };
  io.emit("players", players);

  // movement updates
  socket.on("move", (pos) => {
    players[socket.id] = pos;
    socket.broadcast.emit("playerMoved", { id: socket.id, pos });
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