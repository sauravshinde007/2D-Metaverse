// Phaser/scenes/World.js
import Phaser from "phaser";
import { InputManager } from "../input/InputManager";
import socketService from "../../services/socketService"; // ✅ Import the new service

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
  }

  preload() {
    // --- 1. Load the Tiled map data ---
    this.load.tilemapTiledJSON("office-map", "/assets/map/test.tmj");

    // --- 2. Load the tileset image ---
    this.load.image( "room-tiles", "/assets/tilesets/Room_Builder_free_32x32.png" );
    this.load.image( "interior-tiles", "/assets/tilesets/Interiors_free_32x32.png" );
    this.load.image( "office-tiles", "/assets/tilesets/Modern_Office_Black_Shadow.png" );
    this.load.image("room-floor", "/assets/tilesets/Room_Builder_Floors.png");

    // --- 3. Load the player spritesheet ---
    this.load.spritesheet("ash", "/assets/characters/ash.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    socketService.connect(); // ✅ Connect using the service

    const map = this.make.tilemap({ key: "office-map" });

    // --- Link the Tiled tileset name to the Phaser image key ---
    const roomTileset = map.addTilesetImage( "Room_Builder_free_32x32", "room-tiles" );
    const interiorTileset = map.addTilesetImage( "Interiors_free_32x32", "interior-tiles" );
    const officeTileset = map.addTilesetImage( "Modern_Office_Black_Shadow", "office-tiles" );
    const roomfloorTileset = map.addTilesetImage( "Room_Builder_Floors", "room-floor" );

    const allTimesets = [ interiorTileset, roomTileset, officeTileset, roomfloorTileset, ];

    // --- Create Layers ---
    const groundLayer = map.createLayer("Ground", allTimesets, 0, 0);
    const wallsLayer = map.createLayer("Wall", allTimesets, 0, 0);
    const propsLayer = map.createLayer("Props", allTimesets, 0, 0);
    const propsLayer1 = map.createLayer("Props1", allTimesets, 0, 0);
    const propsLayer2 = map.createLayer("Props2", allTimesets, 0, 0);

    // --- Set Depth for Correct Rendering Order ---
    groundLayer.setDepth(0);
    wallsLayer.setDepth(1);
    propsLayer.setDepth(2);
    propsLayer1.setDepth(3);
    propsLayer2.setDepth(4);

    // --- Set Up Collisions ---
    wallsLayer.setCollisionByProperty({ collides: true });
    propsLayer.setCollisionByProperty({ collides: true });
    propsLayer1.setCollisionByProperty({ collides: true });
    propsLayer2.setCollisionByProperty({ collides: true });

    // --- World and Camera Bounds ---
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // --- Player Setup ---
    this.players = {};
    this.createAnimations();
    this.player = this.physics.add.sprite(1162, 1199, "ash");
    this.player.setDepth(5);
    this.physics.add.collider(this.player, wallsLayer);
    this.physics.add.collider(this.player, propsLayer);
    this.player.setCollideWorldBounds(true);
    this.lastDirection = "down";
    this.currentAnimation = "idle-down";
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1);

    // --- Input Manager Setup ---
    this.inputManager = new InputManager(this);
    this.setupInputHandlers();

    // --- ✅ (Socket.IO listeners updated to use the service) ---
    socketService.onPlayers((players) => {
      Object.keys(players).forEach((id) => {
        // We get the current client's socket ID directly from the service
        const currentSocketId = socketService.socket?.id;
        if (id !== currentSocketId) {
          this.addOtherPlayer(id, players[id]);
        }
      });
    });

    socketService.onPlayerJoined(({ id, x, y, anim }) => this.addOtherPlayer(id, { x, y, anim }));

    socketService.onPlayerMoved(({ id, pos, anim }) => {
      if (this.players[id]) {
        this.tweens.add({ targets: this.players[id], x: pos.x, y: pos.y, duration: 120, ease: "Linear", });
        if (anim && this.players[id].anims) this.players[id].anims.play(anim, true);
      }
    });

    socketService.onPlayerLeft((id) => {
      if (this.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
      }
    });

    this.movement = { up: false, down: false, left: false, right: false };

    // Network Optimization
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
        socketService.emitMove(currentState); // ✅ Use service to emit
        this.lastSentState = currentState;
      }
    }, 100);
  }

  createAnimations() {
    this.anims.create({ key: "idle-right", frames: this.anims.generateFrameNumbers("ash", { start: 0, end: 5 }), repeat: -1, frameRate: 15, });
    this.anims.create({ key: "idle-up", frames: this.anims.generateFrameNumbers("ash", { start: 6, end: 11 }), repeat: -1, frameRate: 15, });
    this.anims.create({ key: "idle-left", frames: this.anims.generateFrameNumbers("ash", { start: 12, end: 17 }), repeat: -1, frameRate: 15, });
    this.anims.create({ key: "idle-down", frames: this.anims.generateFrameNumbers("ash", { start: 18, end: 23 }), repeat: -1, frameRate: 15, });
    this.anims.create({ key: "walk-right", frames: this.anims.generateFrameNumbers("ash", { start: 24, end: 29 }), frameRate: 10, repeat: -1, });
    this.anims.create({ key: "walk-up", frames: this.anims.generateFrameNumbers("ash", { start: 30, end: 35 }), frameRate: 10, repeat: -1, });
    this.anims.create({ key: "walk-left", frames: this.anims.generateFrameNumbers("ash", { start: 36, end: 41 }), frameRate: 10, repeat: -1, });
    this.anims.create({ key: "walk-down", frames: this.anims.generateFrameNumbers("ash", { start: 42, end: 47 }), frameRate: 15, repeat: -1, });
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

  handleInteraction() {
    console.log("Player interaction");
  }

  addOtherPlayer(id, data) {
    const other = this.physics.add
      .sprite(data.x, data.y, "ash")
      .setTint(0xff0000);
    other.setImmovable(true);
    other.setCollideWorldBounds(true);
    other.setDepth(3); // Same depth as the main player
    if (data.anim) other.anims.play(data.anim, true);
    else other.setFrame(18);
    this.players[id] = other;
  }

  update() {
    if (!this.player || !this.player.body) return;

    if (this.inputManager.chatFocused) {
      this.player.body.setVelocity(0); // Stop player movement
      this.movement = { up: false, down: false, left: false, right: false };
      const idleAnim = `idle-${this.lastDirection}`;
      if (this.currentAnimation !== idleAnim) {
        this.currentAnimation = idleAnim;
        this.player.anims.play(this.currentAnimation, true);
      }
      return;
    }

    const speed = 200;
    this.player.body.setVelocity(0);

    let dx = 0;
    let dy = 0;
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
  }

  shutdown() {
    if (this.positionUpdateInterval) clearInterval(this.positionUpdateInterval);
    if (this.inputManager) this.inputManager.destroy();

    // ✅ Disconnect and clean up listeners via the service
    socketService.removeAllListeners();
    socketService.disconnect();
  }
}