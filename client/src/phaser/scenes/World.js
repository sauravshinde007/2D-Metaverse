// client/src/phaser/scenes/World.js
import Phaser from "phaser";
import { InputManager } from "../input/InputManager";
import socketService from "../../services/socketService";
import peerService from "../../services/peerService";
import PhaserRaycaster from 'phaser-raycaster'

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
    this.raycasterPlugin = null;
    this.audioElements = {}; // Store audio elements for each peer
    this.currentNearbyPlayers = new Set(); // Track current nearby players
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

    // Initialize raycaster plugin
    this.raycasterPlugin = this.plugins.get('PhaserRaycaster');

    // Wait for socket connection before joining and initializing PeerJS
    const waitForSocket = () => {
      if (socketService.socket && socketService.socket.connected) {
        console.log('✅ Socket connected, joining game');
        socketService.socket.emit("joinGame", this.username);
        
        // Initialize PeerJS after socket is connected
        this.initializePeerJS();
      } else {
        console.log('⏳ Waiting for socket connection...');
        setTimeout(waitForSocket, 100);
      }
    };
    waitForSocket();

    const map = this.make.tilemap({ key: "office-map" });

    //Tilsets
    const roomTileset = map.addTilesetImage("Room_Builder_free_32x32", "room-tiles");
    const interiorTileset = map.addTilesetImage("Interiors_free_32x32", "interior-tiles");
    const officeTileset = map.addTilesetImage("Modern_Office_Black_Shadow", "office-tiles");
    const roomfloorTileset = map.addTilesetImage("Room_Builder_Floors", "room-floor");
    const allTimesets = [interiorTileset, roomTileset, officeTileset, roomfloorTileset];

    //Layers
    const groundLayer = map.createLayer("Ground", allTimesets, 0, 0);
    const wallsLayer = map.createLayer("Wall", allTimesets, 0, 0);
    const propsLayer = map.createLayer("Props", allTimesets, 0, 0);
    const propsLayer1 = map.createLayer("Props1", allTimesets, 0, 0);
    const propsLayer2 = map.createLayer("Props2", allTimesets, 0, 0);

    //Setup layers
    groundLayer.setDepth(0); 
    wallsLayer.setDepth(1); 
    propsLayer.setDepth(2); 
    propsLayer1.setDepth(3); 
    propsLayer2.setDepth(4);

    wallsLayer.setCollisionByProperty({ collides: true }); 
    propsLayer.setCollisionByProperty({ collides: true });
    propsLayer1.setCollisionByProperty({ collides: true }); 
    propsLayer2.setCollisionByProperty({ collides: true });

    // Map collision layers to raycaster for line-of-sight checking
    if (this.raycasterPlugin) {
      this.raycasterPlugin.mapGameObjects([wallsLayer, propsLayer, propsLayer1, propsLayer2], true);
      console.log('✅ Raycaster mapped to collision layers');
    }

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.players = {};
    this.createAnimations();
    this.player = this.physics.add.sprite(1162, 1199, "ash");
    this.playerUsernameText = this.add.text(this.player.x, this.player.y - 30, this.username, {
        fontSize: '14px', fill: '#90EE90', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.player.setDepth(5);
    this.playerUsernameText.setDepth(6);
    this.physics.add.collider(this.player, wallsLayer);
    this.physics.add.collider(this.player, propsLayer);
    this.player.setCollideWorldBounds(true);
    this.lastDirection = "down";
    this.currentAnimation = "idle-down";
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1);
    this.inputManager = new InputManager(this);
    this.setupInputHandlers();
    socketService.onPlayers((players) => {
      Object.keys(players).forEach((id) => {
        const currentSocketId = socketService.socket?.id;
        if (id !== currentSocketId) { this.addOtherPlayer(id, players[id]); }
      });
    });
    socketService.onPlayerJoined((playerData) => this.addOtherPlayer(playerData.id, playerData));
    socketService.onPlayerMoved(({ id, pos, anim }) => {
      const playerContainer = this.players[id];
      if (playerContainer) {
        this.tweens.add({ targets: playerContainer, x: pos.x, y: pos.y, duration: 120, ease: "Linear" });
        const playerSprite = playerContainer.getAt(0);
        if (anim && playerSprite.anims) playerSprite.anims.play(anim, true);
      }
    });
    socketService.onPlayerLeft((id) => {
      if (this.players[id]) { this.players[id].destroy(); delete this.players[id]; }
    });
    this.movement = { up: false, down: false, left: false, right: false };
    this.lastSentState = { x: 0, y: 0, anim: "" };
    
    // Track nearby players with throttling
    this.lastNearbyPlayersUpdate = 0;
    this.nearbyPlayersUpdateInterval = 1000; // Send nearby players every 1 second
    
    this.positionUpdateInterval = setInterval(() => {
      const currentState = { x: Math.round(this.player.x), y: Math.round(this.player.y), anim: this.currentAnimation };
      if (currentState.x !== this.lastSentState.x || currentState.y !== this.lastSentState.y || currentState.anim !== this.lastSentState.anim) {
        socketService.emitMove(currentState);
        this.lastSentState = currentState;
      }
    }, 100);

    // Setup PeerJS event handlers
    this.setupProximityCallHandlers();
  }

  async initializePeerJS() {
    try {
      // Wait for socket to be ready
      if (!socketService.socket?.id) {
        console.log('⏳ Waiting for socket connection for PeerJS...');
        setTimeout(() => this.initializePeerJS(), 200);
        return;
      }

      console.log('🎤 Initializing PeerJS with socket ID:', socketService.socket.id);

      // Initialize PeerJS with socket ID
      await peerService.initialize(socketService.socket.id);
      console.log('✅ PeerJS connected');
      
      // Register peer ID with server
      socketService.registerPeerId(socketService.socket.id);
      console.log('📝 Registered peer ID with server');

      // Request microphone permission with user gesture
      // Browsers require user interaction for mic permission
      console.log('🎤 Requesting microphone access...');
      console.log('⚠️ If browser blocks, user needs to interact with page first');
      
      await peerService.getUserMedia(false, true);
      console.log('✅ Microphone access granted!');
      console.log('✅ PeerJS initialized for proximity voice chat');

      // Setup stream received handler
      peerService.onStreamReceived((peerId, stream) => {
        console.log('🔊 Received audio stream from:', peerId);
        this.handleRemoteStream(peerId, stream);
      });

      // Setup call ended handler
      peerService.onCallEnded((peerId) => {
        console.log('📴 Call ended with:', peerId);
        this.handleCallEnded(peerId);
      });

    } catch (error) {
      console.error('❌ Failed to initialize PeerJS:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.name === 'NotAllowedError') {
        console.error('⚠️ Microphone permission denied by user');
        this.showMicrophonePrompt();
      } else if (error.name === 'NotFoundError') {
        console.error('⚠️ No microphone found');
        alert('No microphone detected. Please connect a microphone to use voice chat');
      } else {
        console.error('⚠️ Unexpected error:', error);
        this.showMicrophonePrompt();
      }
    }
  }

  showMicrophonePrompt() {
    // Create a UI overlay prompting user to enable microphone
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 30px;
      border-radius: 10px;
      z-index: 10000;
      text-align: center;
      font-family: Arial, sans-serif;
    `;
    overlay.innerHTML = `
      <h2>🎤 Enable Voice Chat</h2>
      <p>Click the button below to enable proximity voice chat.</p>
      <p style="font-size: 12px; color: #aaa;">You'll be asked for microphone permission.</p>
      <button id="enable-mic-btn" style="
        padding: 15px 30px;
        font-size: 16px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 15px;
      ">Enable Microphone</button>
      <br>
      <button id="skip-mic-btn" style="
        padding: 10px 20px;
        font-size: 14px;
        background: transparent;
        color: #aaa;
        border: 1px solid #aaa;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 10px;
      ">Skip (Play without voice)</button>
    `;
    document.body.appendChild(overlay);

    document.getElementById('enable-mic-btn').onclick = async () => {
      try {
        await peerService.getUserMedia(false, true);
        console.log('✅ Microphone enabled after user interaction');
        overlay.remove();
        
        // Setup handlers now that we have permission
        peerService.onStreamReceived((peerId, stream) => {
          this.handleRemoteStream(peerId, stream);
        });
        peerService.onCallEnded((peerId) => {
          this.handleCallEnded(peerId);
        });
      } catch (err) {
        console.error('Failed to get microphone:', err);
        alert('Could not access microphone. Please check your browser settings.');
      }
    };

    document.getElementById('skip-mic-btn').onclick = () => {
      console.log('User chose to skip voice chat');
      overlay.remove();
    };
  }

  setupProximityCallHandlers() {
    console.log('🎯 Setting up proximity call handlers');
    
    // Handle server telling us to initiate calls with nearby players
    socketService.onInitiateProximityCalls((data) => {
      console.log('📞 Server says initiate proximity calls with:', data.nearbyPlayers);
      console.log('📊 Current nearby players:', Array.from(this.currentNearbyPlayers));
      console.log('🎤 PeerJS status - Has peer:', !!peerService.peer, 'Has stream:', !!peerService.localStream);
      
      const newNearbyPlayerIds = new Set(data.nearbyPlayers.map(p => p.id));
      
      // End calls with players who are no longer nearby
      this.currentNearbyPlayers.forEach(playerId => {
        if (!newNearbyPlayerIds.has(playerId)) {
          console.log('👋 Player moved away, ending call:', playerId);
          peerService.endCall(playerId);
          this.currentNearbyPlayers.delete(playerId);
        }
      });

      // Start calls with newly nearby players
      data.nearbyPlayers.forEach(player => {
        if (!this.currentNearbyPlayers.has(player.id)) {
          console.log('🆕 New player in range, attempting call to:', player.username, 'ID:', player.id);
          if (!peerService.peer) {
            console.error('❌ Cannot call - PeerJS not initialized!');
          } else if (!peerService.localStream) {
            console.error('❌ Cannot call - No local stream! Please enable microphone.');
          } else {
            peerService.callPeer(player.id);
            this.currentNearbyPlayers.add(player.id);
          }
        } else {
          console.log('✅ Already in call with player:', player.username);
        }
      });
    });

    // Handle notification that we're in proximity of another player
    socketService.onPlayerInProximity((data) => {
      console.log('👥 In proximity of player:', data.username, 'Distance:', data.distance);
    });
  }

  handleRemoteStream(peerId, stream) {
    console.log('✅ Received audio stream from:', peerId);
    console.log('Stream details:', {
      id: stream.id,
      active: stream.active,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    // Create or update audio element for this peer
    if (!this.audioElements[peerId]) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.srcObject = stream;
      
      // Add to DOM to ensure it plays
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      this.audioElements[peerId] = audio;
      
      // Log when audio starts playing
      audio.onloadedmetadata = () => {
        console.log('Audio metadata loaded for:', peerId);
        audio.play().then(() => {
          console.log('✅ Audio playback started for:', peerId);
        }).catch(err => {
          console.error('❌ Audio playback failed for:', peerId, err);
        });
      };
      
      // Optionally add spatial audio based on player position
      // You can adjust volume based on distance
      const player = this.players[peerId];
      if (player) {
        this.updateAudioVolume(peerId);
      }
    }
  }

  handleCallEnded(peerId) {
    console.log('📴 Call ended with:', peerId);
    
    // Remove audio element
    if (this.audioElements[peerId]) {
      const audio = this.audioElements[peerId];
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      delete this.audioElements[peerId];
    }
    
    this.currentNearbyPlayers.delete(peerId);
  }

  updateAudioVolume(peerId) {
    const audioElement = this.audioElements[peerId];
    const player = this.players[peerId];
    
    if (!audioElement || !player) return;

    // Calculate distance between players
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      player.x,
      player.y
    );

    // Adjust volume based on distance (closer = louder)
    // Max distance is 100 (from getNearByPlayers radius)
    const volume = Math.max(0, 1 - (distance / 100));
    audioElement.volume = volume;
  }

  getNearByPlayers(radius = 100) {
    const nearbyPlayers = [];
    
    if (!this.raycasterPlugin) {
      // Fallback to simple distance-based if raycaster not available
      Object.keys(this.players).forEach((id) => {
        const otherPlayer = this.players[id];
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          otherPlayer.x,
          otherPlayer.y
        );
        
        if (distance <= radius) {
          nearbyPlayers.push({
            id: id,
            username: otherPlayer.list[1].text,
            x: otherPlayer.x,
            y: otherPlayer.y,
            distance: Math.round(distance)
          });
        }
      });
      return nearbyPlayers;
    }

    // Use raycasting: Cast rays in a circle to detect players within radius
    // Cast 360-degree rays to find all nearby players
    const numRays = 36; // Cast 36 rays (every 10 degrees)
    const angleStep = (Math.PI * 2) / numRays;
    const detectedPlayers = new Set(); // Track already detected players

    for (let i = 0; i < numRays; i++) {
      const angle = i * angleStep;
      
      // Create ray from player position
      const ray = this.raycasterPlugin.createRay({
        origin: { 
          x: this.player.x, 
          y: this.player.y 
        }
      });
      
      // Set ray direction and length
      ray.setAngle(angle);
      ray.setRayRange(radius);
      
      // Cast the ray and get all intersections
      const intersections = ray.cast();
      
      if (intersections && intersections.length > 0) {
        // Check each intersection
        for (let intersection of intersections) {
          const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            intersection.x,
            intersection.y
          );
          
          // Only consider intersections within radius
          if (distance <= radius) {
            // Check if ray hit a player sprite (not a wall)
            // Look for which player is at this position
            Object.keys(this.players).forEach((id) => {
              if (detectedPlayers.has(id)) return; // Skip if already detected
              
              const otherPlayer = this.players[id];
              const playerSprite = otherPlayer.list[0]; // Get sprite from container
              
              // Check if intersection point is close to player position
              const distanceToPlayer = Phaser.Math.Distance.Between(
                intersection.x,
                intersection.y,
                otherPlayer.x,
                otherPlayer.y
              );
              
              // If ray hit near this player (within sprite bounds ~32px)
              if (distanceToPlayer < 40) {
                // Check if there's a wall between us and the player
                let hasWallBlocking = false;
                
                // Cast a direct ray to the player to check for walls
                const directRay = this.raycasterPlugin.createRay({
                  origin: { x: this.player.x, y: this.player.y }
                });
                
                // Calculate angle to player
                const angleToPlayer = Phaser.Math.Angle.Between(
                  this.player.x,
                  this.player.y,
                  otherPlayer.x,
                  otherPlayer.y
                );
                
                directRay.setAngle(angleToPlayer);
                const directIntersections = directRay.cast();
                
                // Check if any wall is closer than the player
                if (directIntersections && directIntersections.length > 0) {
                  const playerDistance = Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    otherPlayer.x,
                    otherPlayer.y
                  );
                  
                  for (let wallIntersection of directIntersections) {
                    const wallDistance = Phaser.Math.Distance.Between(
                      this.player.x,
                      this.player.y,
                      wallIntersection.x,
                      wallIntersection.y
                    );
                    
                    // If wall is significantly closer, it's blocking
                    if (wallDistance < playerDistance - 20) {
                      hasWallBlocking = true;
                      break;
                    }
                  }
                }
                
                // Add player if no wall is blocking
                if (!hasWallBlocking) {
                  detectedPlayers.add(id);
                  nearbyPlayers.push({
                    id: id,
                    username: otherPlayer.list[1].text,
                    x: otherPlayer.x,
                    y: otherPlayer.y,
                    distance: Math.round(Phaser.Math.Distance.Between(
                      this.player.x,
                      this.player.y,
                      otherPlayer.x,
                      otherPlayer.y
                    ))
                  });
                }
              }
            });
          }
        }
      }
    }
    
    return nearbyPlayers;
  }

  sendNearbyPlayersToBackend(nearbyPlayers) {
    // Send the list of nearby players to the backend
    const playerIds = nearbyPlayers.map(p => p.id);
    socketService.socket.emit("nearbyPlayers", {
      playerId: socketService.socket.id,
      nearbyPlayerIds: playerIds,
      count: playerIds.length
    });
  }
  createAnimations() {
    this.anims.create({ key: "idle-right", frames: this.anims.generateFrameNumbers("ash", { start: 0, end: 5 }), repeat: -1, frameRate: 15 });
    this.anims.create({ key: "idle-up", frames: this.anims.generateFrameNumbers("ash", { start: 6, end: 11 }), repeat: -1, frameRate: 15 });
    this.anims.create({ key: "idle-left", frames: this.anims.generateFrameNumbers("ash", { start: 12, end: 17 }), repeat: -1, frameRate: 15 });
    this.anims.create({ key: "idle-down", frames: this.anims.generateFrameNumbers("ash", { start: 18, end: 23 }), repeat: -1, frameRate: 15 });
    this.anims.create({ key: "walk-right", frames: this.anims.generateFrameNumbers("ash", { start: 24, end: 29 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "walk-up", frames: this.anims.generateFrameNumbers("ash", { start: 30, end: 35 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "walk-left", frames: this.anims.generateFrameNumbers("ash", { start: 36, end: 41 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "walk-down", frames: this.anims.generateFrameNumbers("ash", { start: 42, end: 47 }), frameRate: 15, repeat: -1 });
  }

  setupInputHandlers() {
    this.events.on("gameInput", (input) => this.handleGameInput(input));
  }

  handleGameInput(input) {
    const { type, action } = input;
    if (type === "keydown") {
      switch (action) {
        case "MOVE_UP": this.movement.up = true; break;
        case "MOVE_DOWN": this.movement.down = true; break;
        case "MOVE_LEFT": this.movement.left = true; break;
        case "MOVE_RIGHT": this.movement.right = true; break;
        case "INTERACT": this.handleInteraction(); break;
      }
    } else if (type === "keyup") {
      switch (action) {
        case "MOVE_UP": this.movement.up = false; break;
        case "MOVE_DOWN": this.movement.down = false; break;
        case "MOVE_LEFT": this.movement.left = false; break;
        case "MOVE_RIGHT": this.movement.right = false; break;
      }
    }
  }

  handleInteraction() { console.log("Player interaction"); }

  addOtherPlayer(id, data) {
    const otherPlayerSprite = this.add.sprite(0, 0, "ash");
    const usernameText = this.add.text(0, -30, data.username, {
      fontSize: '14px', fill: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    const playerContainer = this.add.container(data.x, data.y, [otherPlayerSprite, usernameText]);
    playerContainer.setDepth(5);
    if (data.anim) otherPlayerSprite.anims.play(data.anim, true);
    else otherPlayerSprite.setFrame(18);
    this.players[id] = playerContainer;
  }

  update() {
    if (!this.player || !this.player.body) return;
    this.playerUsernameText.setPosition(this.player.x, this.player.y - 30);
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
    const speed = 200; this.player.body.setVelocity(0); let dx = 0, dy = 0;
    if (this.movement.left) dx = -1; else if (this.movement.right) dx = 1;
    if (this.movement.up) dy = -1; else if (this.movement.down) dy = 1;
    this.player.body.setVelocityX(dx * speed); this.player.body.setVelocityY(dy * speed);
    this.player.body.velocity.normalize().scale(speed);
    if (this.player.body.velocity.x < 0) { this.currentAnimation = "walk-left"; this.lastDirection = "left"; }
    else if (this.player.body.velocity.x > 0) { this.currentAnimation = "walk-right"; this.lastDirection = "right"; }
    else if (this.player.body.velocity.y < 0) { this.currentAnimation = "walk-up"; this.lastDirection = "up"; }
    else if (this.player.body.velocity.y > 0) { this.currentAnimation = "walk-down"; this.lastDirection = "down"; }
    else { this.currentAnimation = `idle-${this.lastDirection}`; }
    this.player.anims.play(this.currentAnimation, true);
    
    // Get nearby players and send to backend (throttled)
    const currentTime = Date.now();
    if (currentTime - this.lastNearbyPlayersUpdate >= this.nearbyPlayersUpdateInterval) {
      const nearbyPlayers = this.getNearByPlayers(300);
      
      // Always send update, even if no players nearby (to end calls when players move away)
      socketService.emitNearbyPlayers({
        playerId: socketService.socket.id,
        nearbyPlayers: nearbyPlayers,
        count: nearbyPlayers.length
      });

      // Update audio volumes for all nearby players
      nearbyPlayers.forEach(player => {
        this.updateAudioVolume(player.id);
      });

      this.lastNearbyPlayersUpdate = currentTime;
    }
  }

  shutdown() {
    if (this.positionUpdateInterval) clearInterval(this.positionUpdateInterval);
    if (this.inputManager) this.inputManager.destroy();
    
    // Cleanup PeerJS connections
    peerService.destroy();
    
    // Cleanup audio elements
    Object.values(this.audioElements).forEach(audio => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    });
    this.audioElements = {};
    
    socketService.removeAllListeners();
  }
}