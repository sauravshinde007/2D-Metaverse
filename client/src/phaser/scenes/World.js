
import Phaser from "phaser";
import { InputManager } from "../input/InputManager";
import MapManager from "../managers/MapManager";
import CameraManager from "../managers/CameraManager";
import PlayerManager from "../managers/PlayerManager";
import VoiceManager from "../managers/VoiceManager";
import NetworkManager from "../managers/NetworkManager";
import socketService from "../../services/socketService";
import peerService from "../../services/peerService";

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
    // Managers
    this.mapManager = null;
    this.cameraManager = null;
    this.playerManager = null;
    this.voiceManager = null;
    this.networkManager = null;
    this.inputManager = null;

    // Core Dependencies
    this.raycasterPlugin = null;
  }

  init(data) {
    this.username = data.username;
  }

  preload() {
    // Keep internal preload for now, or move to AssetLoader if desired.
    // Given the request was to make World.js modular, keeping asset definitions here is fine,
    // or we could delegate to MapManager/PlayerManager preloads.
    this.load.tilemapTiledJSON("office-map", "/assets/map/test.tmj");
    this.load.image("room-tiles", "/assets/tilesets/Room_Builder_free_32x32.png");
    this.load.image("interior-tiles", "/assets/tilesets/Interiors_free_32x32.png");
    this.load.image("office-tiles", "/assets/tilesets/Modern_Office_Black_Shadow.png");
    this.load.image("room-floor", "/assets/tilesets/Room_Builder_Floors.png");
    this.load.spritesheet("ash", "/assets/characters/ash.png", {
      frameWidth: 32, frameHeight: 48,
    });
  }

  create() {
    // 0. Connect Socket
    socketService.connect();

    // 1. Setup Systems & Managers
    this.raycasterPlugin = this.plugins.get("PhaserRaycaster");
    this.inputManager = new InputManager(this); // Wraps Keyboard

    this.mapManager = new MapManager(this);
    this.cameraManager = new CameraManager(this);
    this.playerManager = new PlayerManager(this, this.inputManager, this.mapManager);
    this.voiceManager = new VoiceManager(this);
    this.networkManager = new NetworkManager(this, this.playerManager, this.mapManager, this.voiceManager);

    // 2. Initialize Logic

    // Map
    this.mapManager.create();
    this.mapManager.registerRaycaster(this.raycasterPlugin);

    // Player
    this.playerManager.createAnimations();
    // We create local player AFTER map so it's on top? Or respect depths.
    // Actually we wait for socket to join before spawning?
    // The original code spawned player at generic location (1162, 1199) then synced.
    this.playerManager.createLocalPlayer(1162, 1199, this.username);

    // Camera
    this.cameraManager.create(this.mapManager.width, this.mapManager.height);
    this.cameraManager.startFollow(this.playerManager.player);

    // 3. Network Connection Flow
    this.waitForSocketConnection();
  }

  waitForSocketConnection() {
    const check = () => {
      if (socketService.socket && socketService.socket.connected) {
        console.log("✅ Socket connected, joining game");
        socketService.socket.emit("joinGame", this.username);

        // Init Handlers & PeerJS
        this.networkManager.setupListeners();
        this.voiceManager.initialize(socketService.socket.id);
      } else {
        console.log("⏳ Waiting for socket connection...");
        setTimeout(check, 100);
      }
    };
    check();
  }

  update(time, delta) {
    // Delegate updates
    if (this.playerManager) this.playerManager.update(this.networkManager.myRole);
    if (this.cameraManager) this.cameraManager.update();

    // Network update (throttled inside)
    if (this.networkManager) this.networkManager.update(time);

    // Update audio volumes for spatial sound
    if (this.voiceManager && this.playerManager) {
      // iterate all players and update volume based on sanitized ID match
      const players = this.playerManager.players;
      Object.keys(players).forEach(socketId => {
        const peerId = peerService.getPeerId(socketId);
        if (this.voiceManager.audioElements[peerId]) {
          const otherContainer = players[socketId];
          const otherPlayer = { x: otherContainer.x, y: otherContainer.y };
          this.voiceManager.updateAudioVolume(this.playerManager.player, otherPlayer, peerId);
        }
      });

      // Update local video bubble pos
      this.voiceManager.updateLocalVideoPosition(this.playerManager.player, this.cameras.main);
    }
  }
}