// server/socket/socketHandler.js
import User from "../models/User.js";
import { ROOM_ACCESS_LEVELS } from "../config/roles.js";

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

        // Get role from user (default to employee if missing)
        const userRole = user.role || 'employee';

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
            // Transfer position to current user object so new session uses it
            if (oldPlayer.x !== undefined && oldPlayer.y !== undefined) {
              user.lastX = oldPlayer.x;
              user.lastY = oldPlayer.y;
            }

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

        // Check if player exists on this socket to preserve position
        const existingPlayer = players[socket.id];

        // Use existing (hot-reload) OR saved (db) OR default
        const startX = existingPlayer ? existingPlayer.x : (user.lastX || 1162);
        const startY = existingPlayer ? existingPlayer.y : (user.lastY || 1199);

        players[socket.id] = {
          username,
          x: startX,
          y: startY,
          anim: existingPlayer ? existingPlayer.anim : "idle-down",
          peerId: existingPlayer ? existingPlayer.peerId : null,
          videoEnabled: existingPlayer ? existingPlayer.videoEnabled : false,
          nearbyPlayers: [],
          role: userRole,
        };

        // Send full state to the new player
        socket.emit("players", players);

        // Send game configuration (room access rules)
        socket.emit("gameRules", {
          roomAccess: ROOM_ACCESS_LEVELS
        });

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

          // Save last position
          if (p && p.x !== undefined && p.y !== undefined) {
            user.lastX = p.x;
            user.lastY = p.y;
            console.log(`Saving position for ${p.username}: ${p.x}, ${p.y}`);
          }

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
