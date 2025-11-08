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

        // If user already has an active session, tell old socket to disconnect
        if (user.activeSocketId && user.activeSocketId !== socket.id) {
          console.log(
            `User '${username}' already active (${user.activeSocketId}). Forcing old session to disconnect.`
          );
          io.to(user.activeSocketId).emit(
            "forceDisconnect",
            "You have logged in from another device."
          );
        }

        // Mark this socket as the active session
        user.activeSocketId = socket.id;
        await user.save();

        console.log(`${username} joined with socket: ${socket.id}`);
        players[socket.id] = {
          username,
          x: 1162,
          y: 1199,
          anim: "idle-down",
          peerId: null,
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

    // Disconnect cleanup
    socket.on("disconnect", async () => {
      const p = players[socket.id];
      if (!p) {
        console.log("Disconnected before joining:", socket.id);
        return;
      }

      console.log(`${p.username} disconnected: ${socket.id}`);
      try {
        // Clear active session for this user
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
