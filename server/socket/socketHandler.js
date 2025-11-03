// server/socket/socketHandler.js
import User from '../models/User.js';

export default (io) => {
  let players = {};

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // MODIFIED: Listen for a player officially joining with their username
    socket.on("joinGame", async (username) => { // ✅ 2. Make this function async
      try {
        const user = await User.findOne({ username });
        if (!user) {
          // This case should ideally not happen if auth is working, but it's good practice
          console.error(`User '${username}' not found in database.`);
          return;
        }

        // ✅ 3. Check for an existing active session
        if (user.activeSocketId && user.activeSocketId !== socket.id) {
          console.log(`User '${username}' already has an active session (${user.activeSocketId}). Disconnecting old session.`);
          // Emit an event to the old socket telling it to disconnect
          io.to(user.activeSocketId).emit('forceDisconnect', 'You have logged in from another device.');
        }

        // ✅ 4. Update the user's active socket ID in the database
        user.activeSocketId = socket.id;
        await user.save();

        console.log(`${username} joined with ID: ${socket.id}`);
        players[socket.id] = {
          username: username,
          x: 1162,
          y: 1199,
          anim: "idle-down",
        };

        socket.emit("players", players);
        socket.broadcast.emit("playerJoined", {
          id: socket.id,
          ...players[socket.id],
        });

      } catch (error) {
        console.error("Error during joinGame:", error);
      }
    });

    socket.on("move", (data) => {
      if (players[socket.id]) {
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        players[socket.id].anim = data.anim;

        socket.broadcast.emit("playerMoved", {
          id: socket.id,
          pos: { x: data.x, y: data.y },
          anim: data.anim,
        });
      }
    });

    // Handle nearby players data from client
    socket.on("nearbyPlayers", (data) => {
      console.log(`Player ${socket.id} has ${data.count} nearby players`);
      
      if (players[socket.id]) {
        // Store nearby players for this player
        players[socket.id].nearbyPlayers = data.nearbyPlayers;
        
        // Send peer connection info to initiate video/audio calls
        // The client will use this to establish PeerJS connections
        socket.emit("initiateProximityCalls", {
          nearbyPlayers: data.nearbyPlayers.map(p => ({
            id: p.id,
            username: p.username,
            distance: p.distance
          }))
        });
        
        // Notify each nearby player about this player's proximity
        data.nearbyPlayers.forEach(nearbyPlayer => {
          const nearbyPlayerId = nearbyPlayer.id;
          if (players[nearbyPlayerId]) {
            io.to(nearbyPlayerId).emit("playerInProximity", {
              id: socket.id,
              username: players[socket.id].username,
              distance: nearbyPlayer.distance
            });
          }
        });
      }
    });

    // Handle peer ID registration for video/audio calls
    socket.on("registerPeerId", (peerId) => {
      if (players[socket.id]) {
        players[socket.id].peerId = peerId;
        console.log(`Registered PeerID ${peerId} for ${players[socket.id].username}`);
      }
    });

    socket.on("disconnect", async () => { // ✅ 5. Make this function async
      if (players[socket.id]) {
        console.log(`${players[socket.id].username} disconnected: ${socket.id}`);
        try {
          // ✅ 6. Clear the activeSocketId from the database on disconnect
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
      } else {
        console.log("Disconnected before joining:", socket.id);
      }
    });
  });
};