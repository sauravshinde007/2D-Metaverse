// src/services/socketService.js

import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL;
let socket = null;

const socketService = {
  connect() {
    // Prevent multiple connections
    if (socket && socket.connected) {
      return;
    }

    console.log("🔌 Connecting to socket server...");
    socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("✅ Socket connected with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected.");
    });
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  // --- Emitters (Sending data to server) ---
  emitMove(positionData) {
    if (socket) {
      socket.emit("move", positionData);
    }
  },

  // --- Listeners (Receiving data from server) ---
  onPlayers(callback) {
    if (socket) {
      socket.on("players", callback);
    }
  },
  
  onPlayerJoined(callback) {
    if (socket) {
      socket.on("playerJoined", callback);
    }
  },
  
  onPlayerMoved(callback) {
    if (socket) {
      socket.on("playerMoved", callback);
    }
  },
  
  onPlayerLeft(callback) {
    if (socket) {
      socket.on("playerLeft", callback);
    }
  },
  
  // Method to remove all listeners, useful for cleanup
  removeAllListeners() {
      if (socket) {
          socket.removeAllListeners();
      }
  }
};

export default socketService;