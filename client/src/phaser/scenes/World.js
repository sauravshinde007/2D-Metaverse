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

    // 🔌 Socket Listener References (for cleanup)
    this.socketHandlers = {};
    this.peerUnsubscribes = [];
    this.myVideoElement = null;
    this.isProximityMode = false;
    this.localVideoEnabled = false; // Track this separately
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

    this.mapWidth = map.widthInPixels;
    this.mapHeight = map.heightInPixels;

    // Dispatch map size to React for UI Minimap
    window.dispatchEvent(new CustomEvent('map-init', {
      detail: { width: this.mapWidth, height: this.mapHeight }
    }));

    this.players = {};
    this.createAnimations();

    // Local player
    this.player = this.physics.add.sprite(1162, 1199, "ash");
    this.playerUsernameText = this.add
      .text(this.player.x, this.player.y - 30, "You", {
        fontSize: "14px",
        fill: "#90EE90",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // ✨ Local Player Highlight (Avatar Glow)
    // using preFX for better performance on single sprites
    const localGlow = this.player.preFX.addGlow(0xffffff, 4, 0, false, 0.1, 10);
    localGlow.setActive(false);

    this.player.setInteractive();
    this.player.on('pointerover', () => {
      localGlow.setActive(true);
    });
    this.player.on('pointerout', () => {
      localGlow.setActive(false);
    });

    // 🔒 Initialize RBAC Zones
    this.createRestrictedZones(map);

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

    // 🖱️ Mouse Drag to Pan Camera
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let camStart = { x: 0, y: 0 };

    this.input.on('pointerdown', (pointer) => {
      // Only left click (button 0)
      // Ensure not clicking on UI
      if (pointer.button === 0) {
        this.cameras.main.stopFollow();
        isDragging = true;
        dragStart.x = pointer.x;
        dragStart.y = pointer.y;
        camStart.x = this.cameras.main.scrollX;
        camStart.y = this.cameras.main.scrollY;
        this.input.setDefaultCursor('grabbing');
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (isDragging) {
        if (!pointer.isDown) {
          isDragging = false;
          this.input.setDefaultCursor('default');
          return;
        }
        const zoom = this.cameras.main.zoom;
        // Calculate how much mouse moved in SCREEN pixels, divide by zoom to get WORLD units
        const diffX = (pointer.x - dragStart.x) / zoom;
        const diffY = (pointer.y - dragStart.y) / zoom;

        this.cameras.main.scrollX = camStart.x - diffX;
        this.cameras.main.scrollY = camStart.y - diffY;
      }
    });

    this.input.on('pointerup', () => {
      isDragging = false;
      this.input.setDefaultCursor('default');
    });

    // Safety: if mouse leaves window
    this.input.on('pointerout', () => {
      isDragging = false;
      this.input.setDefaultCursor('default');
    });

    // 🖱️ Mouse Wheel Zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomAmount = 0.3; // Sensitivity
      let newZoom = this.cameras.main.zoom;

      if (deltaY > 0) {
        // Scrolled Down -> Zoom Out
        newZoom -= zoomAmount;
      } else if (deltaY < 0) {
        // Scrolled Up -> Zoom In
        newZoom += zoomAmount;
      }

      // Clamp Zoom (Min: 0.5x, Max: 3.0x)
      newZoom = Phaser.Math.Clamp(newZoom, 0.5, 3.0);

      // Apply smooth zoom
      this.cameras.main.zoomTo(newZoom, 100, 'Linear', true);
    });

    // ➕ UI Button Zoom Integration
    window.addEventListener('zoom-in', () => {
      let newZoom = this.cameras.main.zoom + 0.3;
      newZoom = Phaser.Math.Clamp(newZoom, 0.5, 3.0);
      this.cameras.main.zoomTo(newZoom, 200, 'Linear', true);
    });

    window.addEventListener('zoom-out', () => {
      let newZoom = this.cameras.main.zoom - 0.3;
      newZoom = Phaser.Math.Clamp(newZoom, 0.5, 3.0);
      this.cameras.main.zoomTo(newZoom, 200, 'Linear', true);
    });

    // ✋ Drag-to-Pan Logic
    this.isMapDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.isCameraFollowEnabled = true;

    this.input.on('pointerdown', (pointer) => {
      if (!pointer.isDown) return;
      this.isMapDragging = true;
      this.dragStart.x = pointer.x;
      this.dragStart.y = pointer.y;
      this.cameras.main.stopFollow();
      this.isCameraFollowEnabled = false;
      this.game.canvas.style.cursor = 'grabbing';
    });

    this.input.on('pointerup', () => {
      this.isMapDragging = false;
      this.game.canvas.style.cursor = 'default';
      // Note: We don't enable follow here immediately, keeping the panned view until movement.
    });

    this.input.on('pointermove', (pointer) => {
      if (this.isMapDragging && pointer.isDown) {
        const cam = this.cameras.main;

        // Calculate delta in screen pixels, adjusted by zoom
        // We want to move camera OPPOSITE to drag direction
        const deltaX = (pointer.x - this.dragStart.x) / cam.zoom;
        const deltaY = (pointer.y - this.dragStart.y) / cam.zoom;

        cam.scrollX -= deltaX;
        cam.scrollY -= deltaY;

        // Reset start for next frame
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
      }
    });

    // Input
    this.inputManager = new InputManager(this);
    this.setupInputHandlers();

    this.createMobileJoystick(); // 🔵 Create mobile joysticsk

    // Socket event wiring
    // Store handlers so we can remove them later
    this.socketHandlers.onPlayers = (players) => {
      if (!this.scene.isActive()) return;
      Object.keys(players).forEach((id) => {
        const myId = socketService.socket?.id;
        if (id !== myId) {
          this.addOtherPlayer(id, players[id]);
        } else {
          // Sync my own position from server truth to prevent overwriting it with default spawn
          if (players[id].x !== undefined && players[id].y !== undefined) {
            this.player.setPosition(players[id].x, players[id].y);
            // Also update the username text position immediately
            if (this.playerUsernameText) {
              this.playerUsernameText.setPosition(players[id].x, players[id].y - 30);
            }
          }

          if (players[id].role) {
            this.myRole = players[id].role;
            console.log("👮 My Role is:", this.myRole);
            this.updateZoneVisuals();
          }
        }
      });
    };
    socketService.onPlayers(this.socketHandlers.onPlayers);

    this.socketHandlers.onGameRules = (rules) => {
      if (!this.scene.isActive()) return;
      console.log("📜 Received Game Rules:", rules);
      if (rules.roomAccess) {
        this.roomAccessRules = rules.roomAccess;
        this.updateZoneVisuals();
      }
    };
    socketService.onGameRules(this.socketHandlers.onGameRules);

    this.socketHandlers.onPlayerJoined = (playerData) => {
      if (!this.scene.isActive()) return;
      this.addOtherPlayer(playerData.id, playerData);
    };
    socketService.onPlayerJoined(this.socketHandlers.onPlayerJoined);

    this.socketHandlers.onPlayerMoved = ({ id, pos, anim }) => {
      if (!this.scene.isActive()) return;
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
    };
    socketService.onPlayerMoved(this.socketHandlers.onPlayerMoved);

    this.socketHandlers.onPlayerLeft = (id) => {
      if (!this.scene.isActive()) return;
      if (this.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
        this.playerUsernames.delete(id);
      }
    };
    socketService.onPlayerLeft(this.socketHandlers.onPlayerLeft);

    this.socketHandlers.onPlayerReaction = ({ id, emoji }) => {
      if (!this.scene.isActive()) return;

      let target = null;
      if (id === socketService.socket.id) {
        target = this.player;
      } else {
        target = this.players[id];
      }

      if (target) {
        this.showReaction(target, emoji);
      }
    };
    socketService.onPlayerReaction(this.socketHandlers.onPlayerReaction);

    // Register cleanup on scene shutdown
    this.events.on('shutdown', this.cleanupSocketListeners, this);
    this.events.on('destroy', this.cleanupSocketListeners, this);

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
    this.isProximityMode = false; // Initialize proximity mode state
    this.localVideoEnabled = false; // Initialize local video enabled state

    // Listen for UI toggles
    window.addEventListener('local-video-toggle', (e) => {
      console.log("📺 Local video toggle event:", e.detail);
      this.localVideoEnabled = e.detail;
      this.toggleLocalVideo(e.detail);
    });

    // Listen for Proximity Mode changes
    window.addEventListener('proximity-video-active', (e) => {
      // console.log("🔄 Proximity mode changed:", e.detail);
      this.isProximityMode = e.detail;
      // Re-evaluate video display
      this.toggleLocalVideo(this.localVideoEnabled);
    });
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
      const unsubStream = peerService.onStreamReceived((peerId, stream) => {
        console.log("🔊 Received audio stream from:", peerId);
        this.handleRemoteStream(peerId, stream);
      });
      this.peerUnsubscribes.push(unsubStream);

      const unsubCallEnd = peerService.onCallEnded((peerId) => {
        console.log("📴 Call ended with:", peerId);
        this.handleCallEnded(peerId);
      });
      this.peerUnsubscribes.push(unsubCallEnd);
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

    this.socketHandlers.onInitiateProximityCalls = (data) => {
      if (!this.scene.isActive()) return;
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
          }, 1000); // 1 second grace period

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
    };
    socketService.onInitiateProximityCalls(this.socketHandlers.onInitiateProximityCalls);

    this.socketHandlers.onPlayerInProximity = (data) => {
      // console.log("👥 In proximity of:", data.username, "Distance:", data.distance); 
    };
    socketService.onPlayerInProximity(this.socketHandlers.onPlayerInProximity);
  }

  showReaction(target, emoji) {
    // Create text object above the player
    const x = target.x;
    const y = target.y - 50;

    const emojiText = this.add.text(x, y, emoji, {
      fontSize: "32px",
    }).setOrigin(0.5).setDepth(100);

    // Animate: Float up and fade out
    this.tweens.add({
      targets: emojiText,
      y: y - 40,
      alpha: 0,
      duration: 2000,
      ease: "Power1",
      onComplete: () => {
        emojiText.destroy();
      }
    });
  }

  cleanupSocketListeners() {
    console.log("🧹 Cleaning up socket listeners...");
    if (this.socketHandlers.onPlayers) socketService.off("players", this.socketHandlers.onPlayers);
    if (this.socketHandlers.onGameRules) socketService.off("gameRules", this.socketHandlers.onGameRules);
    if (this.socketHandlers.onPlayerJoined) socketService.off("playerJoined", this.socketHandlers.onPlayerJoined);
    if (this.socketHandlers.onPlayerMoved) socketService.off("playerMoved", this.socketHandlers.onPlayerMoved);
    if (this.socketHandlers.onPlayerLeft) socketService.off("playerLeft", this.socketHandlers.onPlayerLeft);
    if (this.socketHandlers.onInitiateProximityCalls) socketService.off("initiateProximityCalls", this.socketHandlers.onInitiateProximityCalls);
    if (this.socketHandlers.onPlayerInProximity) socketService.off("playerInProximity", this.socketHandlers.onPlayerInProximity);
    if (this.socketHandlers.onPlayerReaction) socketService.off("playerReaction", this.socketHandlers.onPlayerReaction);

    this.socketHandlers = {};

    // Cleanup PeerService listeners
    if (this.peerUnsubscribes) {
      this.peerUnsubscribes.forEach((unsub) => unsub && unsub());
      this.peerUnsubscribes = [];
    }
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
  createRestrictedZones(map) {
    // 1. Try to load from Tiled Map Object Layer
    const zoneLayer = map ? map.getObjectLayer("Zones") : null;
    this.restrictedZones = []; // Reset

    if (zoneLayer && zoneLayer.objects) {
      console.log("🗺️ Loading Restricted Zones from Tiled Map...");

      zoneLayer.objects.forEach((obj) => {
        // Tiled objects usually have properties array. We look for 'zoneId' custom property.
        // If not found, fall back to object name.
        const idProp = obj.properties && obj.properties.find(p => p.name === "zoneId");
        const zoneId = idProp ? idProp.value : obj.name;

        // Also look for a 'name' property for display, or use the object name
        const nameProp = obj.properties && obj.properties.find(p => p.name === "zoneName"); // Optional custom prop
        const zoneName = nameProp ? nameProp.value : (obj.name || zoneId);

        // Phaser Tiled object Y is usually bottom-left for some types, top-left for rects.
        // We assume simple rectangles from Tiled.
        this.restrictedZones.push({
          id: zoneId,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          name: zoneName, // Display name
        });
      });
      console.log("✅ Loaded Zones:", this.restrictedZones);
    }

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
    // Prevent duplicates/ghosts
    if (this.players[id]) {
      this.players[id].destroy();
    }

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

    // ✨ REMOTE PLAYER Highlight (Avatar Glow)
    const remoteGlow = otherPlayerSprite.preFX.addGlow(0xffffff, 4, 0, false, 0.1, 10);
    remoteGlow.setActive(false);

    otherPlayerSprite.setInteractive();
    otherPlayerSprite.on('pointerover', () => {
      remoteGlow.setActive(true);
    });
    otherPlayerSprite.on('pointerout', () => {
      remoteGlow.setActive(false);
    });
    playerContainer.setDepth(5);
    if (data.anim) otherPlayerSprite.anims.play(data.anim, true);
    else otherPlayerSprite.setFrame(18);
    this.players[id] = playerContainer;

    this.playerUsernames.set(id, data.username); // <-- ADD to map
  }

  update() {
    if (!this.player || !this.player.body) return;

    // 📡 Dispatch Minimap Data
    const otherPlayers = Object.keys(this.players).map(id => ({
      id,
      x: this.players[id].x,
      y: this.players[id].y
    }));

    window.dispatchEvent(new CustomEvent('minimap-update', {
      detail: {
        me: { x: this.player.x, y: this.player.y },
        others: otherPlayers
      }
    }));

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

    // 🚶 Re-enable Camera Follow on Movement
    if (dx !== 0 || dy !== 0) {
      if (!this.cameras.main._follow) {
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      }
    }

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

    // New: Sync local video position
    this.updateLocalVideoPosition();
  }

  updateLocalVideoPosition() {
    // If in proximity mode, the video is handled by the UI, not a bubble
    if (this.isProximityMode) {
      if (this.myVideoElement && this.myVideoElement.style.display !== 'none') {
        this.myVideoElement.style.display = 'none'; // Hide if it somehow exists
      }
      return;
    }

    if (this.myVideoElement && this.player) {
      // Calculate screen position manually as worldToCamera is not standard on all Phaser versions/types

      // Player is ~48px tall, text is at -30. Let's put video at -80
      const videoExp = document.getElementById('local-video-bubble');
      if (videoExp) {
        // We need absolute screen position (taking into account canvas offset if any)
        // Assuming canvas fills window for now or standard layout

        // worldToCamera gives partial, we need absolute
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();

        const cam = this.cameras.main;
        const zoom = cam.zoom;

        // Calculate screen coordinates relative to viewport
        const screenX = (this.player.x - cam.worldView.x) * zoom;
        const screenY = (this.player.y - cam.worldView.y) * zoom;

        // Base dimensions at 1.0 zoom
        const baseW = 80;
        const baseH = 60;
        const baseVOffset = 50; // Distance above player center to bottom of video

        // Scaled dimensions
        const curW = baseW * zoom;
        const curH = baseH * zoom;
        const curOffset = baseVOffset * zoom;

        videoExp.style.width = `${curW}px`;
        videoExp.style.height = `${curH}px`;

        videoExp.style.left = `${rect.left + screenX - (curW / 2)}px`;
        videoExp.style.top = `${rect.top + screenY - curH - curOffset}px`;

        // Only show if on screen
        if (
          screenX < -curW || screenX > cam.width + curW ||
          screenY < -curH || screenY > cam.height + curH
        ) {
          videoExp.style.display = 'none';
        } else {
          videoExp.style.display = 'block';
          videoExp.style.pointerEvents = 'none'; // Force no interaction
        }
      }
    }
  }

  toggleLocalVideo(enabled) {
    // If NOT enabled, remove bubble always
    if (!enabled) {
      if (this.myVideoElement) {
        if (this.myVideoElement.parentNode) {
          this.myVideoElement.parentNode.removeChild(this.myVideoElement);
        }
        this.myVideoElement = null;
      }
      return;
    }

    // IF enabled...
    // Only show bubble if NOT in proximity mode
    if (this.isProximityMode) {
      // Hide bubble if it exists, because video is in top bar
      if (this.myVideoElement) {
        if (this.myVideoElement.parentNode) {
          this.myVideoElement.parentNode.removeChild(this.myVideoElement);
        }
        this.myVideoElement = null;
      }
      return;
    }

    // Otherwise, Create/Show bubble
    if (!this.myVideoElement) {
      const vid = document.createElement("video");
      vid.id = "local-video-bubble";
      vid.autoplay = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.style.position = "absolute";
      vid.style.width = "80px";
      vid.style.height = "60px";
      vid.style.objectFit = "cover";
      vid.style.borderRadius = "8px";
      vid.style.border = "2px solid #9b99fe";
      vid.style.zIndex = "50"; // Above canvas
      vid.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";
      vid.style.pointerEvents = "none"; // Let interaction pass to canvas

      document.body.appendChild(vid);
      this.myVideoElement = vid;

      // Attach stream
      if (peerService.localStream) {
        vid.srcObject = peerService.localStream;
      }
    }
  }
}