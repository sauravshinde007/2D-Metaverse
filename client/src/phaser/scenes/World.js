// client/src/phaser/scenes/World.js
import Phaser from "phaser";
import { InputManager } from "../input/InputManager";
import socketService from "../../services/socketService";
import peerService from "../../services/peerService";
import PhaserRaycaster from "phaser-raycaster"; // keep import so plugin is bundled/available

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
    this.raycasterPlugin = null;
    this.audioElements = {}; // peerId -> HTMLAudioElement
    this.currentNearbyPlayers = new Set(); // track active proximity calls
    this.playerUsernames = new Map();
  }

  init(data) {
    this.username = data.username;
  }

  preload() {
    this.load.tilemapTiledJSON("office-map", "/assets/map/test.tmj");
    this.load.image("room-tiles", "/assets/tilesets/Room_Builder_free_32x32.png");
    this.load.image("interior-tiles", "/assets/tilesets/Interiors_free_32x32.png");
    this.load.image("office-tiles", "/assets/tilesets/Modern_Office_Black_Shadow.png");
    this.load.image("room-floor", "/assets/tilesets/Room_Builder_Floors.png");
    this.load.spritesheet("ash", "/assets/characters/ash.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    socketService.connect();

    // Raycaster plugin instance (must be registered in game config)
    this.raycasterPlugin = this.plugins.get("PhaserRaycaster");

    // Wait for socket connection, then join + init PeerJS
    const waitForSocket = () => {
      if (socketService.socket && socketService.socket.connected) {
        console.log("✅ Socket connected, joining game");
        socketService.socket.emit("joinGame", this.username);
        this.initializePeerJS();
      } else {
        console.log("⏳ Waiting for socket connection...");
        setTimeout(waitForSocket, 100);
      }
    };
    waitForSocket();

    const map = this.make.tilemap({ key: "office-map" });

    // Tilesets
    const roomTileset = map.addTilesetImage("Room_Builder_free_32x32", "room-tiles");
    const interiorTileset = map.addTilesetImage("Interiors_free_32x32", "interior-tiles");
    const officeTileset = map.addTilesetImage("Modern_Office_Black_Shadow", "office-tiles");
    const roomfloorTileset = map.addTilesetImage("Room_Builder_Floors", "room-floor");
    const allTimesets = [interiorTileset, roomTileset, officeTileset, roomfloorTileset];

    // Layers
    const groundLayer = map.createLayer("Ground", allTimesets, 0, 0);
    const wallsLayer = map.createLayer("Wall", allTimesets, 0, 0);
    const propsLayer = map.createLayer("Props", allTimesets, 0, 0);
    const propsLayer1 = map.createLayer("Props1", allTimesets, 0, 0);
    const propsLayer2 = map.createLayer("Props2", allTimesets, 0, 0);

    // Depth
    groundLayer.setDepth(0);
    wallsLayer.setDepth(1);
    propsLayer.setDepth(2);
    propsLayer1.setDepth(3);
    propsLayer2.setDepth(4);

    // Collisions
    wallsLayer.setCollisionByProperty({ collides: true });
    propsLayer.setCollisionByProperty({ collides: true });
    propsLayer1.setCollisionByProperty({ collides: true });
    propsLayer2.setCollisionByProperty({ collides: true });

    // Map collision layers to raycaster for line-of-sight
    if (this.raycasterPlugin) {
      this.raycasterPlugin.mapGameObjects(
        [wallsLayer, propsLayer, propsLayer1, propsLayer2],
        true
      );
      console.log("✅ Raycaster mapped to collision layers");
    }

    // World/camera
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.players = {};
    this.createAnimations();

    // Local player
    this.player = this.physics.add.sprite(1162, 1199, "ash");
    this.playerUsernameText = this.add
      .text(this.player.x, this.player.y - 30, this.username, {
        fontSize: "14px",
        fill: "#90EE90",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.player.setDepth(5);
    this.playerUsernameText.setDepth(6);
    this.physics.add.collider(this.player, wallsLayer);
    this.physics.add.collider(this.player, propsLayer);
    this.player.setCollideWorldBounds(true);
    this.lastDirection = "down";
    this.currentAnimation = "idle-down";

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1.5); // from other branch

    // Input
    this.inputManager = new InputManager(this);
    this.setupInputHandlers();

    // Socket event wiring
    socketService.onPlayers((players) => {
      Object.keys(players).forEach((id) => {
        const myId = socketService.socket?.id;
        if (id !== myId) this.addOtherPlayer(id, players[id]);
      });
    });

    socketService.onPlayerJoined((playerData) =>
      this.addOtherPlayer(playerData.id, playerData)
    );

    socketService.onPlayerMoved(({ id, pos, anim }) => {
      const playerContainer = this.players[id];
      if (playerContainer) {
        this.tweens.add({
          targets: playerContainer,
          x: pos.x,
          y: pos.y,
          duration: 120,
          ease: "Linear",
        });
        const playerSprite = playerContainer.getAt(0);
        if (anim && playerSprite.anims) playerSprite.anims.play(anim, true);
      }
    });

    socketService.onPlayerLeft((id) => {
      if (this.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
        this.playerUsernames.delete(id); // <-- REMOVE from map
      }
    });

    // Movement state + network throttling
    this.movement = { up: false, down: false, left: false, right: false };
    this.lastSentState = { x: 0, y: 0, anim: "" };

    this.positionUpdateInterval = setInterval(() => {
      const currentState = {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        anim: this.currentAnimation,
      };
      if (
        currentState.x !== this.lastSentState.x ||
        currentState.y !== this.lastSentState.y ||
        currentState.anim !== this.lastSentState.anim
      ) {
        socketService.emitMove(currentState);
        this.lastSentState = currentState;
      }
    }, 100);

    // Proximity call handlers (PeerJS)
    this.setupProximityCallHandlers();

    // Nearby players throttling
    this.lastNearbyPlayersUpdate = 0;
    this.nearbyPlayersUpdateInterval = 1000; // ms
  }

  async initializePeerJS() {
    try {
      if (!socketService.socket?.id) {
        console.log("⏳ Waiting for socket connection for PeerJS...");
        setTimeout(() => this.initializePeerJS(), 200);
        return;
      }

      console.log("🎤 Initializing PeerJS with socket ID:", socketService.socket.id);

      await peerService.initialize(socketService.socket.id);
      console.log("✅ PeerJS connected");

      // Register peer id (we’re using socket id as peer id)
      socketService.registerPeerId(socketService.socket.id);
      console.log("📝 Registered peer ID with server");

      // --- CODE REMOVED ---
      // We no longer ask for getUserMedia here.
      // The React UI (VoiceChat.jsx) is now responsible for this
      // when the user clicks the "enable media" button.
      
      // Stream handlers
      peerService.onStreamReceived((peerId, stream) => {
        console.log("🔊 Received audio stream from:", peerId);
        this.handleRemoteStream(peerId, stream);
      });

      peerService.onCallEnded((peerId) => {
        console.log("📴 Call ended with:", peerId);
        this.handleCallEnded(peerId);
      });
    } catch (error) {
      console.error("❌ Failed to initialize PeerJS:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      // We no longer show a prompt here, React UI will handle it.
      alert("Could not initialize voice/video service. Please refresh and try again.");
    }
  }

  setupProximityCallHandlers() {
    console.log("🎯 Setting up proximity call handlers");

    socketService.onInitiateProximityCalls((data) => {
      // console.log("📞 Initiate calls with:", data.nearbyPlayers);
      // console.log("📊 Currently in calls with:", Array.from(this.currentNearbyPlayers));
      // console.log(
      //    "🎤 Peer status:",
      //   "peer=", !!peerService.peer,
      //   "stream=", !!peerService.localStream
      // );

      const newNearbyIds = new Set(data.nearbyPlayers.map((p) => p.id));

      // End calls that are no longer nearby
      this.currentNearbyPlayers.forEach((pid) => {
        if (!newNearbyIds.has(pid)) {
          console.log("👋 Player moved away, ending call:", pid);
          peerService.endCall(pid);
          this.currentNearbyPlayers.delete(pid);
        }
      });

      // Start calls for newly nearby
      data.nearbyPlayers.forEach((p) => {
        if (!this.currentNearbyPlayers.has(p.id)) {
          console.log("🆕 New player in range, call:", p.username, p.id);
          if (!peerService.peer) {
            console.error("❌ Cannot call - PeerJS not initialized");
          } else if (!peerService.localStream) {
            console.error("❌ Cannot call - No local stream (enable mic)");
          } else {
            peerService.callPeer(p.id);
            this.currentNearbyPlayers.add(p.id);
          }
        } else {
          // console.log("✅ Already in call with:", p.username); // Also commented out
        }
      });
    });

    socketService.onPlayerInProximity((data) => {
      // console.log("👥 In proximity of:", data.username, "Distance:", data.distance); // Also commented out
    });
  }

  handleRemoteStream(peerId, stream) {
    // This function handles the *audio* part of the stream for spatial sound.
    // The *video* part is handled by the React VideoGrid component.
    console.log("✅ Received remote stream from:", peerId, {
      id: stream.id,
      active: stream.active,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });

    if (!this.audioElements[peerId]) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.srcObject = stream;
      audio.style.display = "none";
      document.body.appendChild(audio);

      this.audioElements[peerId] = audio;

      audio.onloadedmetadata = () => {
        audio
          .play()
          .then(() => console.log("✅ Audio playback started for:", peerId))
          .catch((err) =>
            console.error("❌ Audio playback failed for:", peerId, err)
          );
      };

      // Initial spatial volume set (if we already know their position)
      const player = this.players[peerId];
      if (player) this.updateAudioVolume(peerId);
    }
  }

  handleCallEnded(peerId) {
    console.log("📴 Call ended with:", peerId);

    if (this.audioElements[peerId]) {
      const audio = this.audioElements[peerId];
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) audio.parentNode.removeChild(audio);
      delete this.audioElements[peerId];
    }

    this.currentNearbyPlayers.delete(peerId);
  }

  updateAudioVolume(peerId) {
    const audioElement = this.audioElements[peerId];
    const player = this.players[peerId];
    if (!audioElement || !player) return;

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      player.x,
      player.y
    );

    // radius used below in getNearByPlayers(); map to [0..1]
    const maxDist = 300;
    const volume = Math.max(0, 1 - distance / maxDist);
    audioElement.volume = volume;
  }

  getNearByPlayers(radius = 300) {
    const nearbyPlayers = [];

    // Fallback: pure distance
    if (!this.raycasterPlugin) {
      Object.keys(this.players).forEach((id) => {
        const other = this.players[id];
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          other.x,
          other.y
        );
        if (distance <= radius) {
          nearbyPlayers.push({
            id,
            username: other.list[1].text,
            x: other.x,
            y: other.y,
            distance: Math.round(distance),
          });
        }
      });
      return nearbyPlayers;
    }

    // Raycast (36 rays around the player) to respect walls/LOS
    const numRays = 36;
    const angleStep = (Math.PI * 2) / numRays;
    const detected = new Set();

    for (let i = 0; i < numRays; i++) {
      const angle = i * angleStep;

      const ray = this.raycasterPlugin.createRay({
        origin: { x: this.player.x, y: this.player.y },
      });
      ray.setAngle(angle);
      ray.setRayRange(radius);

      const intersections = ray.cast();
      if (!intersections || intersections.length === 0) continue;

      for (const pt of intersections) {
        const d = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          pt.x,
          pt.y
        );
        if (d > radius) continue;

        // See if this point maps to any player's container area
        Object.keys(this.players).forEach((id) => {
          if (detected.has(id)) return;
          const other = this.players[id];

          const dToPlayer = Phaser.Math.Distance.Between(
            pt.x,
            pt.y,
            other.x,
            other.y
          );

          if (dToPlayer < 40) {
            // Check wall blocking with a direct ray
            let blocked = false;

            const directRay = this.raycasterPlugin.createRay({
              origin: { x: this.player.x, y: this.player.y },
            });

            const angleTo = Phaser.Math.Angle.Between(
              this.player.x,
              this.player.y,
              other.x,
              other.y
            );
            directRay.setAngle(angleTo);
            const directHits = directRay.cast();

            if (directHits && directHits.length > 0) {
              const playerDist = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                other.x,
                other.y
              );
              for (const wall of directHits) {
                const wallDist = Phaser.Math.Distance.Between(
                  this.player.x,
                  this.player.y,
                  wall.x,
                  wall.y
                );
                if (wallDist < playerDist - 20) {
                  blocked = true;
                  break;
                }
              }
            }

            if (!blocked) {
              detected.add(id);
              nearbyPlayers.push({
                id,
                username: other.list[1].text,
                x: other.x,
                y: other.y,
                distance: Math.round(
                  Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    other.x,
                    other.y
                  )
                ),
              });
            }
          }
        });
      }
    }

    return nearbyPlayers;
  }

  // (kept for reference; we use socketService.emitNearbyPlayers directly)
  // sendNearbyPlayersToBackend(nearbyPlayers) { ... }

  createAnimations() {
    this.anims.create({
      key: "idle-right",
      frames: this.anims.generateFrameNumbers("ash", { start: 0, end: 5 }),
      repeat: -1,
      frameRate: 15,
    });
    this.anims.create({
      key: "idle-up",
      frames: this.anims.generateFrameNumbers("ash", { start: 6, end: 11 }),
      repeat: -1,
      frameRate: 15,
    });
    this.anims.create({
      key: "idle-left",
      frames: this.anims.generateFrameNumbers("ash", { start: 12, end: 17 }),
      repeat: -1,
      frameRate: 15,
    });
    this.anims.create({
      key: "idle-down",
      frames: this.anims.generateFrameNumbers("ash", { start: 18, end: 23 }),
      repeat: -1,
      frameRate: 15,
    });
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("ash", { start: 24, end: 29 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("ash", { start: 30, end: 35 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("ash", { start: 36, end: 41 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("ash", { start: 42, end: 47 }),
      frameRate: 15,
      repeat: -1,
    });
  }

  setupInputHandlers() {
    this.events.on("gameInput", (input) => this.handleGameInput(input));
  }

  handleGameInput(input) {
    const { type, action } = input;
    if (type === "keydown") {
      switch (action) {
        case "MOVE_UP":
          this.movement.up = true;
          break;
        case "MOVE_DOWN":
          this.movement.down = true;
          break;
        case "MOVE_LEFT":
          this.movement.left = true;
          break;
        case "MOVE_RIGHT":
          this.movement.right = true;
          break;
        case "INTERACT":
          this.handleInteraction();
          break;
      }
    } else if (type === "keyup") {
      switch (action) {
        case "MOVE_UP":
          this.movement.up = false;
          break;
        case "MOVE_DOWN":
          this.movement.down = false;
          break;
        case "MOVE_LEFT":
          this.movement.left = false;
          break;
        case "MOVE_RIGHT":
          this.movement.right = false;
          break;
      }
    }
  }

  handleInteraction() {
    console.log("Player interaction");
  }

  addOtherPlayer(id, data) {
    const otherPlayerSprite = this.add.sprite(0, 0, "ash");
    const usernameText = this.add
      .text(0, -30, data.username, {
        fontSize: "14px",
        fill: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const playerContainer = this.add.container(data.x, data.y, [
      otherPlayerSprite,
      usernameText,
    ]);
    playerContainer.setDepth(5);
    if (data.anim) otherPlayerSprite.anims.play(data.anim, true);
    else otherPlayerSprite.setFrame(18);
    this.players[id] = playerContainer;

    this.playerUsernames.set(id, data.username); // <-- ADD to map
  }

  update() {
    if (!this.player || !this.player.body) return;

    // Username text follows player
    this.playerUsernameText.setPosition(this.player.x, this.player.y - 30);

    // Pause movement if chat focused
    if (this.inputManager.chatFocused) {
      this.player.body.setVelocity(0);
      this.movement = { up: false, down: false, left: false, right: false };
      const idleAnim = `idle-${this.lastDirection}`;
      if (this.currentAnimation !== idleAnim) {
        this.currentAnimation = idleAnim;
        this.player.anims.play(this.currentAnimation, true);
      }
      return;
    }

    // Movement
    const speed = 200;
    this.player.body.setVelocity(0);
    let dx = 0,
      dy = 0;
    if (this.movement.left) dx = -1;
    else if (this.movement.right) dx = 1;
    if (this.movement.up) dy = -1;
    else if (this.movement.down) dy = 1;

    this.player.body.setVelocityX(dx * speed);
    this.player.body.setVelocityY(dy * speed);
    this.player.body.velocity.normalize().scale(speed);

    if (this.player.body.velocity.x < 0) {
      this.currentAnimation = "walk-left";
      this.lastDirection = "left";
    } else if (this.player.body.velocity.x > 0) {
      this.currentAnimation = "walk-right";
      this.lastDirection = "right";
    } else if (this.player.body.velocity.y < 0) {
      this.currentAnimation = "walk-up";
      this.lastDirection = "up";
    } else if (this.player.body.velocity.y > 0) {
      this.currentAnimation = "walk-down";
      this.lastDirection = "down";
    } else {
      this.currentAnimation = `idle-${this.lastDirection}`;
    }
    this.player.anims.play(this.currentAnimation, true);

    // Nearby players ping (throttled)
    const now = Date.now();
    if (now - this.lastNearbyPlayersUpdate >= this.nearbyPlayersUpdateInterval) {
      const nearbyPlayers = this.getNearByPlayers(300);

      // Always send, even if empty -> server can end stale calls
      socketService.emitNearbyPlayers({
        playerId: socketService.socket.id,
        nearbyPlayers,
        count: nearbyPlayers.length,
      });

      // Update spatial volumes
      nearbyPlayers.forEach((p) => this.updateAudioVolume(p.id));

      this.lastNearbyPlayersUpdate = now;
    }
  }

  shutdown() {
    if (this.positionUpdateInterval) clearInterval(this.positionUpdateInterval);
    if (this.inputManager) this.inputManager.destroy();

    // PeerJS cleanup
    peerService.destroy();

    // Remove audio elements
    Object.values(this.audioElements).forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) audio.parentNode.removeChild(audio);
    });
    this.audioElements = {};

    socketService.removeAllListeners();
  }
}