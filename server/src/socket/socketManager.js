import { handleAddPlayer } from "./handlers/addPlayerHandler.js";
import { handleUpdatePlayer } from "./handlers/updatePlayerHandler.js";
import { handleDisconnect } from "./handlers/disconnectHandler.js";
import { getPlayers } from "../utils/players.js";
export const socketManager = (io) => {
  io.on("connection", async (socket) => {
    console.log("🟢 New connection:", socket.id);

    // 1️⃣ Add new player
    await handleAddPlayer(io, socket);

    // 2️⃣ Movement updates
    socket.on("move", (data) => {
      const players = getPlayers(); // ✅ always get latest player list
      handleUpdatePlayer(io, socket, data, players);
    });

    // 3️⃣ Disconnect cleanup
    socket.on("disconnect", () => handleDisconnect(io, socket));
  });
};
