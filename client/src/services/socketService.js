// src/services/socketService.js

import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL;
let socket = null;

const socketService = {
  connect() {
    if (socket && socket.connected) {
      return;
    }
    console.log("🔌 Connecting to socket server...");
    socket = io(SOCKET_URL);
    socket.on("connect", () => console.log("✅ Socket connected with ID:", socket.id));
    socket.on("disconnect", () => console.log("❌ Socket disconnected."));
  },

  // ✅ ADDED: A generic method to listen to any socket event.
  // This is crucial for allowing AuthContext to listen for 'forceDisconnect'.
  on(eventName, callback) {
    if (socket) {
      socket.on(eventName, callback);
    }
  },

  get socket() {
    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  emitMove(positionData) {
    if (socket) {
      socket.emit("move", positionData);
    }
  },

  emitNearbyPlayers(nearbyPlayersData) {
    if (socket) {
      socket.emit("nearbyPlayers", nearbyPlayersData);
    }
  },

  registerPeerId(peerId) {
    if (socket) {
      socket.emit("registerPeerId", peerId);
    }
  },

  onInitiateProximityCalls(callback) {
    if (socket) {
      socket.on("initiateProximityCalls", callback);
    }
  },

  onPlayerInProximity(callback) {
    if (socket) {
      socket.on("playerInProximity", callback);
    }
  },

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
  
  removeAllListeners() {
      if (socket) {
          socket.removeAllListeners();
      }
  }
};

export default socketService;