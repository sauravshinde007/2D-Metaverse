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

    // 🔵 Mobile joystick state
    this.joystickBase = null;
    this.joystickThumb = null;
    this.joystickActive = false;
    this.joystickDirection = { up: false, down: false, left: false, right: false };

    // Disconnect grace period timers
    this.disconnectTimers = new Map();

    // 🔒 RBAC State
    this.myRole = 'employee'; // default
    this.roomAccessRules = {};
    this.restrictedZones = []; // { id, x, y, width, height, name }
  }

  init(data) {
    this.username = data.username;
  }

  // Load assets
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

    // 🔒 Initialize RBAC Zones
    this.createRestrictedZones();

    this.player.setDepth(5);
    this.playerUsernameText.setDepth(6);
    this.physics.add.collider(this.player, wallsLayer);
    this.physics.add.collider(this.player, propsLayer);
    this.player.setCollideWorldBounds(true);
    this.lastDirection = "down";
    this.currentAnimation = "idle-down";

    this.cameras.main.startFollow(this.player);
    // 🔍 Responsive zoom
    if (this.isMobileDevice && this.isMobileDevice()) {
      // On mobile: zoom out a bit so you see more of the world
      this.cameras.main.setZoom(1.0);
    } else {
      // Desktop / larger screens
      this.cameras.main.setZoom(1.5);
    }

    // Input
    this.inputManager = new InputManager(this);
    this.setupInputHandlers();

    this.createMobileJoystick(); // 🔵 Create mobile joysticsk

    // Socket event wiring
    socketService.onPlayers((players) => {
      Object.keys(players).forEach((id) => {
        const myId = socketService.socket?.id;
        if (id !== myId) {
          this.addOtherPlayer(id, players[id]);
        } else {
          // It's me! Update my role
          if (players[id].role) {
            this.myRole = players[id].role;
            console.log("👮 My Role is:", this.myRole);
            this.updateZoneVisuals(); // Update visuals based on new role
          }
        }
      });
    });

    socketService.onGameRules((rules) => {
      console.log("📜 Received Game Rules:", rules);
      if (rules.roomAccess) {
        this.roomAccessRules = rules.roomAccess;
        this.updateZoneVisuals();
      }
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
      const newNearbyIds = new Set(data.nearbyPlayers.map((p) => p.id));

      // End calls that are no longer nearby (with Grace Period)
      this.currentNearbyPlayers.forEach((pid) => {
        if (!newNearbyIds.has(pid)) {
          // If already scheduled to disconnect, do nothing (wait)
          if (this.disconnectTimers.has(pid)) return;

          console.log(`⏳ Player ${pid} moved away, scheduling disconnect in 2s...`);

          const timerId = setTimeout(() => {
            console.log("👋 Grace period over, ending call:", pid);
            peerService.endCall(pid);
            this.currentNearbyPlayers.delete(pid);
            this.disconnectTimers.delete(pid);
          }, 2000); // 2 second grace period

          this.disconnectTimers.set(pid, timerId);
        }
      });

      // Start calls for newly nearby
      data.nearbyPlayers.forEach((p) => {
        // If we are pending disconnect for this user, CANCEL it.
        if (this.disconnectTimers.has(p.id)) {
          console.log(`✨ Player ${p.username} returned within grace period!`);
          clearTimeout(this.disconnectTimers.get(p.id));
          this.disconnectTimers.delete(p.id);
          // We consider them still "nearby", so we don't need to call again.
          return;
        }

        if (!this.currentNearbyPlayers.has(p.id)) {
          // console.log("🆕 New player in range, call:", p.username, p.id);

          if (!peerService.peer) {
            // peer not ready
          } else if (!peerService.localStream) {
            // mic not enabled - silence error to avoid spam
          } else {
            // Check if actively in call to avoid double-dialing? 
            // PeerService handles it, but let's be safe
            peerService.callPeer(p.id);
            this.currentNearbyPlayers.add(p.id);
          }
        }
      });
    });

    socketService.onPlayerInProximity((data) => {
      // console.log("👥 In proximity of:", data.username, "Distance:", data.distance); 
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

    // Also clear any pending timers if they exist
    if (this.disconnectTimers.has(peerId)) {
      clearTimeout(this.disconnectTimers.get(peerId));
      this.disconnectTimers.delete(peerId);
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
    const maxDist = 150;
    const volume = Math.max(0, 1 - distance / maxDist);
    audioElement.volume = volume;
  }

  getNearByPlayers(radius = 150) {
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

  // Detect mobile / small screen
  isMobileDevice() {
    const device = this.sys.game.device;
    const smallScreen = window.innerWidth <= 768;
    return !device.os.desktop || smallScreen;
  }

  // Create joystick visuals & pointer events
  createMobileJoystick() {
    if (!this.isMobileDevice()) return;

    const radius = 50;
    const thumbRadius = 25;

    // Base circle
    this.joystickBase = this.add.circle(0, 0, radius, 0x000000, 0.25);
    // Thumb circle
    this.joystickThumb = this.add.circle(0, 0, thumbRadius, 0xffffff, 0.7);

    this.joystickBase.setScrollFactor(0);
    this.joystickThumb.setScrollFactor(0);
    this.joystickBase.setDepth(1000);
    this.joystickThumb.setDepth(1001);

    // Start invisible
    this.joystickBase.setVisible(false);
    this.joystickThumb.setVisible(false);

    // Pointer down: show joystick and start movement
    this.input.on("pointerdown", (pointer) => {
      if (!this.isMobileDevice()) return;
      if (this.inputManager?.chatFocused) return;

      // optional: restrict to left half of screen to avoid UI
      const halfWidth = this.cameras.main.width / 2;
      if (pointer.x > halfWidth) return;

      this.joystickActive = true;
      this.joystickBase.setPosition(pointer.x, pointer.y);
      this.joystickThumb.setPosition(pointer.x, pointer.y);
      this.joystickBase.setVisible(true);
      this.joystickThumb.setVisible(true);

      this.updateJoystickFromPointer(pointer);
    });

    // Pointer move: update thumb + direction
    this.input.on("pointermove", (pointer) => {
      if (!this.joystickActive) return;
      this.updateJoystickFromPointer(pointer);
    });

    // Pointer up: hide joystick + stop movement
    this.input.on("pointerup", () => {
      if (!this.joystickActive) return;
      this.joystickActive = false;
      this.joystickBase.setVisible(false);
      this.joystickThumb.setVisible(false);

      // All directions off
      this.applyJoystickDirection({ up: false, down: false, left: false, right: false });
    });
  }

  // Convert pointer delta into directions + call InputManager
  updateJoystickFromPointer(pointer) {
    if (!this.joystickBase || !this.joystickThumb) return;

    const baseX = this.joystickBase.x;
    const baseY = this.joystickBase.y;

    const dx = pointer.x - baseX;
    const dy = pointer.y - baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const maxDist = 60;
    const deadZone = 10;

    // Clamp thumb to max radius
    let offsetX = dx;
    let offsetY = dy;
    if (dist > maxDist) {
      const scale = maxDist / dist;
      offsetX = dx * scale;
      offsetY = dy * scale;
    }

    this.joystickThumb.setPosition(baseX + offsetX, baseY + offsetY);

    // Inside dead zone → no movement
    if (dist < deadZone) {
      this.applyJoystickDirection({ up: false, down: false, left: false, right: false });
      return;
    }

    // Decide directions based on dominant axis
    const dir = { up: false, down: false, left: false, right: false };

    if (Math.abs(dx) > Math.abs(dy)) {
      // horizontal dominance
      if (dx < -deadZone) dir.left = true;
      else if (dx > deadZone) dir.right = true;
    } else {
      // vertical dominance
      if (dy < -deadZone) dir.up = true;
      else if (dy > deadZone) dir.down = true;
    }

    this.applyJoystickDirection(dir);
  }

  // Compare with previous joystick direction and emit gameInput via InputManager
  applyJoystickDirection(newDir) {
    const prev = this.joystickDirection;

    const emit = (type, action) => {
      // We leverage InputManager's existing pipeline
      this.inputManager.forwardToGame(type, null, action);
    };

    // UP
    if (newDir.up && !prev.up) emit("keydown", "MOVE_UP");
    if (!newDir.up && prev.up) emit("keyup", "MOVE_UP");

    // DOWN
    if (newDir.down && !prev.down) emit("keydown", "MOVE_DOWN");
    if (!newDir.down && prev.down) emit("keyup", "MOVE_DOWN");

    // LEFT
    if (newDir.left && !prev.left) emit("keydown", "MOVE_LEFT");
    if (!newDir.left && prev.left) emit("keyup", "MOVE_LEFT");

    // RIGHT
    if (newDir.right && !prev.right) emit("keydown", "MOVE_RIGHT");
    if (!newDir.right && prev.right) emit("keyup", "MOVE_RIGHT");

    this.joystickDirection = newDir;
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

  // 🔒 RBAC HELPER METHODS
  createRestrictedZones() {
    // Define zones manually (conceptually could come from Map Object Layer)
    // Server Room (Admin only) - Left side Example
    this.restrictedZones.push({
      id: 'server_room',
      name: 'Server Room',
      x: 950, y: 1050, width: 100, height: 100
    });

    // CEO Office (CEO, Admin) - Right side Example
    this.restrictedZones.push({
      id: 'ceo_office',
      name: 'CEO Office',
      x: 1300, y: 1050, width: 100, height: 100
    });

    // Draw them
    this.zoneGraphics = this.add.graphics();
    this.zoneGraphics.setDepth(0); // On ground
    this.updateZoneVisuals();

    // Create text labels for zones
    this.restrictedZones.forEach(zone => {
      const text = this.add.text(zone.x + zone.width / 2, zone.y - 10, zone.name, {
        fontSize: '12px', fill: '#ffffff', backgroundColor: '#000000aa'
      }).setOrigin(0.5);
      text.setDepth(10);
    });
  }

  updateZoneVisuals() {
    if (!this.zoneGraphics) return;
    this.zoneGraphics.clear();

    this.restrictedZones.forEach(zone => {
      const allowedRoles = this.roomAccessRules[zone.id] || [];
      const canAccess = allowedRoles.includes(this.myRole);

      const color = canAccess ? 0x00ff00 : 0xff0000;
      const alpha = 0.3;

      this.zoneGraphics.fillStyle(color, alpha);
      this.zoneGraphics.fillRect(zone.x, zone.y, zone.width, zone.height);

      // Border
      this.zoneGraphics.lineStyle(2, color, 1);
      this.zoneGraphics.strokeRect(zone.x, zone.y, zone.width, zone.height);
    });
  }

  checkZoneAccess() {
    if (!this.player) return;

    // Predict next position
    // (Simplified: just check current position. If inside restricted, push back)

    const px = this.player.x;
    const py = this.player.y;

    this.restrictedZones.forEach(zone => {
      const inZone = (px > zone.x && px < zone.x + zone.width &&
        py > zone.y && py < zone.y + zone.height);

      if (inZone) {
        const allowedRoles = this.roomAccessRules[zone.id] || [];
        const canAccess = allowedRoles.includes(this.myRole);

        if (!canAccess) {
          // Access Denied! Bounce back.
          // Simple bounce: find center of zone and push away
          const centerX = zone.x + zone.width / 2;
          const centerY = zone.y + zone.height / 2;
          const angle = Phaser.Math.Angle.Between(centerX, centerY, px, py);

          // Push player out
          const pushDist = 5;
          this.player.x += Math.cos(angle) * pushDist;
          this.player.y += Math.sin(angle) * pushDist;

          // Optional: Show warning (debounced)
          if (!this.lastAccessDeniedWarning || Date.now() - this.lastAccessDeniedWarning > 1000) {
            this.showAccessDeniedWarning(zone.name);
            this.lastAccessDeniedWarning = Date.now();
          }
        }
      }
    });
  }

  showAccessDeniedWarning(zoneName) {
    if (!this.scene.isActive()) return;

    const toast = this.add.text(this.player.x, this.player.y - 60, `🔒 Access to ${zoneName} Denied`, {
      fontSize: '16px',
      fontStyle: 'bold',
      fill: '#ff0000',
      stroke: '#ffffff',
      strokeThickness: 4,
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: toast,
      y: toast.y - 50,
      alpha: 0,
      duration: 1500,
      onComplete: () => toast.destroy()
    });
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

    // 🔒 RESTRICTED ZONE ENFORCEMENT
    this.checkZoneAccess();

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
      const nearbyPlayers = this.getNearByPlayers(150);

      // Always send, even if empty -> server can end stale calls
      socketService.emitNearbyPlayers({
        nearbyPlayers: nearbyPlayers,
      });

      this.lastNearbyPlayersUpdate = now;
    }
  }
}