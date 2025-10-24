// utils/players.js

// In-memory player storage
let players = {};

// Add a new player with default position + animation
export const addPlayer = (id) => {
  players[id] = {
    x: 400,
    y: 300,
    anim: "idle-down",
  };
  return players[id];
};

// Update an existing player's position + animation
export const updatePlayer = (id, data) => {
  if (!players[id]) return;
  players[id].x = data.x;
  players[id].y = data.y;
  players[id].anim = data.anim;
};

// Remove a disconnected player
export const removePlayer = (id) => {
  delete players[id];
};

// Return all current players
export const getPlayers = () => {
  return players;
};
