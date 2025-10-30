// server/socket/socketHandler.js
export default (io) => {
  let players = {};

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    players[socket.id] = { 
      x: 1162, 
      y: 1199,
      anim: "idle-down"
    };
    
    //socket.emit("players", players);

    // Listen for the client's request instead
    socket.on("getPlayers", () => {
      socket.emit("players", players);
    });
    
    socket.broadcast.emit("playerJoined", {
      id: socket.id,
      ...players[socket.id]
    });

    socket.on("move", (data) => {
      if (players[socket.id]) {
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        players[socket.id].anim = data.anim;
        
        socket.broadcast.emit("playerMoved", {
          id: socket.id,
          pos: { x: data.x, y: data.y },
          anim: data.anim
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
      delete players[socket.id];
      io.emit("playerLeft", socket.id);
    });
  });
};