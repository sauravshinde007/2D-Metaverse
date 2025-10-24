import { removePlayer } from "../../utils/players.js";

export const handleDisconnect = (io, socket) => {
  removePlayer(socket.id);
  io.emit("playerLeft", socket.id);
  console.log(`❌ Player disconnected: ${socket.id}`);
};
