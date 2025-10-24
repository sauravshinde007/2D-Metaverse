import { addPlayer, getPlayers } from "../../utils/players.js";
import { getGlobalRoom, createProximityChat } from "../../utils/streamchat.js";

export const handleAddPlayer = async (io, socket) => {
  const newPlayer = addPlayer(socket.id);

  // Notify client about all players
  socket.emit("players", getPlayers());
  socket.broadcast.emit("playerJoined", { id: socket.id, ...newPlayer });

  // --- Global Chat ---
  const globalRoom = await getGlobalRoom();
  //socket.emit("joinedGlobalChat", { channelId: globalRoom.id });

  // --- Proximity Chat ---
  const players = getPlayers();
  const proximityRoom = await createProximityChat(players, socket.id);
  if (proximityRoom) {
    //socket.emit("joinedProximityChat", { channelId: proximityRoom.id });
  }

  console.log(`✅ Player added: ${socket.id}`);
};
