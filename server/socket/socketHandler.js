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