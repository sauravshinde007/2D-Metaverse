import { updatePlayer } from "../../utils/players.js";
import { createProximityChat } from "../../utils/streamchat.js";

const playerChannels = {}; // Track which proximity chat each player is in

export const handleUpdatePlayer = async (io, socket, data, players) => {
  // Update server-side player state
  updatePlayer(socket.id, data);

  // Broadcast movement to others
  socket.broadcast.emit("playerMoved", {
    id: socket.id,
    pos: { x: data.x, y: data.y },
    anim: data.anim,
  });

  // --- 🔍 Handle proximity chat ---
  const channel = await createProximityChat(players, socket.id);

  if (channel) {
    const newChannelId = channel.id;

    // If player changed proximity group, update membership
    if (playerChannels[socket.id] !== newChannelId) {
      // Leave old one if any
      if (playerChannels[socket.id]) {
        const oldChannel = channel.client.channel(
          "messaging",
          playerChannels[socket.id]
        );
        await oldChannel.removeMembers([socket.id]);
      }

      playerChannels[socket.id] = newChannelId;
      //socket.emit("joinedProximityChat", { channelId: newChannelId });
    }
  } else {
    // No nearby players → leave previous chat
    if (playerChannels[socket.id]) {
      // Use serverClient to get the old channel, since channel is null here
      const { serverClient } = await import("../../utils/streamchat.js");
      const oldChannel = serverClient.channel(
        "messaging",
        playerChannels[socket.id]
      );
      if (oldChannel) await oldChannel.removeMembers([socket.id]);
      delete playerChannels[socket.id];
      //socket.emit("leftProximityChat");
    }
  }
};
