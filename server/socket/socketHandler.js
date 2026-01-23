// server/socket/socketHandler.js
import User from "../models/User.js";

export default (io) => {
  // id -> player state
  const players = Object.create(null);

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Player joins with their username
    socket.on("joinGame", async (username) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          console.error(`User '${username}' not found in database.`);
          return;
        }

        // If user already has an active session, force old session to logout
        if (user.activeSocketId && user.activeSocketId !== socket.id) {
          const oldSocketId = user.activeSocketId;

          console.log(
            `User '${username}' already active (${oldSocketId}). Forcing old session to disconnect.`
          );

          // Tell old client to log out
          io.to(oldSocketId).emit(
            "forceDisconnect",
            "You have logged in from another device."
          );

          // 🔴 Immediately clean up old player on the server
          const oldPlayer = players[oldSocketId];
          if (oldPlayer) {
            delete players[oldSocketId];
            io.emit("playerLeft", oldSocketId);
          }

          // 🔴 Optionally, hard-disconnect the old socket if it's still alive
          const oldSocket = io.sockets.sockets.get(oldSocketId);
          if (oldSocket) {
            oldSocket.disconnect(true);
          }
        }

        // Mark THIS socket as the active session
        user.activeSocketId = socket.id;
        await user.save();

        console.log(`${username} joined with socket: ${socket.id}`);

        players[socket.id] = {
          username,
          x: 1162,
          y: 1199,
          anim: "idle-down",
          peerId: null,
          videoEnabled: false, // Default to video off
          nearbyPlayers: [],
        };

        // Send full state to the new player
        socket.emit("players", players);

        // Announce to others
        socket.broadcast.emit("playerJoined", {
          id: socket.id,
          ...players[socket.id],
        });
      } catch (error) {
        console.error("Error during joinGame:", error);
      }
    });

    // Movement updates
    socket.on("move", (data) => {
      const p = players[socket.id];
      if (!p) return;

      // minimal shape validation
      const { x, y, anim } = data ?? {};
      if (typeof x === "number") p.x = x;
      if (typeof y === "number") p.y = y;
      if (typeof anim === "string") p.anim = anim;

      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        pos: { x: p.x, y: p.y },
        anim: p.anim,
      });
    });

    // Proximity: client reports nearby players (for PeerJS calls)
    socket.on("nearbyPlayers", (data) => {
      const me = players[socket.id];
      if (!me) return;

      const nearby = Array.isArray(data?.nearbyPlayers)
        ? data.nearbyPlayers
        : [];

      // Store on server (optional, useful for debugging/analytics)
      me.nearbyPlayers = nearby;

      // Ask client to initiate PeerJS calls to these peers
      socket.emit("initiateProximityCalls", {
        nearbyPlayers: nearby.map((p) => ({
          id: p.id,
          username: p.username,
          distance: p.distance,
        })),
      });

      // Notify each nearby player that "me" is in proximity too
      for (const np of nearby) {
        const targetId = np.id;
        if (players[targetId]) {
          io.to(targetId).emit("playerInProximity", {
            id: socket.id,
            username: me.username,
            distance: np.distance,
          });
        }
      }
    });

    // Register PeerJS id for this socket
    socket.on("registerPeerId", (peerId) => {
      const p = players[socket.id];
      if (!p) return;
      p.peerId = String(peerId || "");
      console.log(`Registered PeerID ${p.peerId} for ${p.username}`);
    });

    // Broadcast video toggle
    socket.on("videoStatus", (enabled) => {
      const p = players[socket.id];
      if (!p) return;
      p.videoEnabled = !!enabled; // persist on server
      socket.broadcast.emit("playerVideoStatus", { id: socket.id, videoEnabled: p.videoEnabled });
    });

    socket.on("disconnect", async () => {
      const p = players[socket.id];
      if (!p) {
        console.log("Disconnected before joining:", socket.id);
        return;
      }

      console.log(`${p.username} disconnected: ${socket.id}`);

      try {
        const user = await User.findOne({ activeSocketId: socket.id });
        if (user) {
          user.activeSocketId = null;
          await user.save();
          console.log(`Cleared active session for ${user.username}`);
        }
      } catch (error) {
        console.error("Error clearing socketId on disconnect:", error);
      }

      delete players[socket.id];
      io.emit("playerLeft", socket.id);
    });
  });
};
