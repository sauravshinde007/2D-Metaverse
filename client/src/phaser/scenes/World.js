// Phaser/scenes/World.js
import Phaser from "phaser";
import { io } from "socket.io-client";
import { InputManager } from "../input/InputManager";

export default class WorldScene extends Phaser.Scene {
    constructor() {
        super("WorldScene");
    }

    preload() {
        this.load.image("background", "/assets/steptodown.com169408.jpg");
        
        // Load the ash character sprite sheet
        this.load.spritesheet("ash", "/assets/characters/ash.png", {
            frameWidth: 32,
            frameHeight: 48
        });
    }

    create() {
        this.socket = io(import.meta.env.VITE_SOCKET_SERVER_URL);

        // ✅ background
        this.background = this.add.image(0, 0, "background").setOrigin(0, 0);
        this.background.setDisplaySize(1920, 1080);

        // ✅ world + camera bounds
        this.cameras.main.setBounds(
            0,
            0,
            this.background.displayWidth,
            this.background.displayHeight
        );
        this.physics.world.setBounds(
            0,
            0,
            this.background.displayWidth,
            this.background.displayHeight
        );

        this.players = {}; // store other players

        // Create all animations
        this.createAnimations();

        // ✅ spawn local player with sprite instead of image
        this.player = this.add.sprite(400, 300, "ash");
        this.player.setScale(1.5);
        this.player.setFrame(18); // Set default frame (idle-down first frame)

        // Store last direction for idle animations
        this.lastDirection = "down";
        this.currentAnimation = "idle-down"; // Track current animation

        // ✅ camera follows local player
        this.cameras.main.startFollow(this.player);

        // Initialize input manager
        this.inputManager = new InputManager(this);
        
        // Set up game input listeners
        this.setupInputHandlers();

        // Listen for existing players when joining
        this.socket.on("players", (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) {
                    this.addOtherPlayer(id, players[id]);
                }
            });
        });

        // ✅ Listen for NEW players joining AFTER you
        this.socket.on("playerJoined", ({ id, x, y, anim }) => {
            console.log("New player joined:", id);
            this.addOtherPlayer(id, { x, y, anim });
        });

        // when a player moves - now includes animation data
        this.socket.on("playerMoved", ({ id, pos, anim }) => {
            if (this.players[id]) {
                // Update position with tween
                this.tweens.add({
                    targets: this.players[id],
                    x: pos.x,
                    y: pos.y,
                    duration: 120,
                    ease: "Linear"
                });

                // Play the animation if provided
                if (anim && this.players[id].anims) {
                    this.players[id].anims.play(anim, true);
                }
            }
        });

        // when a player leaves
        this.socket.on("playerLeft", (id) => {
            if (this.players[id]) {
                this.players[id].destroy();
                delete this.players[id];
            }
        });
        
        // Set up movement state
        this.movement = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        
        // Send position AND animation updates at a fixed interval
        this.positionUpdateInterval = setInterval(() => {
            // Always send current position and animation state
            this.socket.emit("move", { 
                x: this.player.x, 
                y: this.player.y,
                anim: this.currentAnimation // Send current animation
            });
        }, 100); // Update every 100ms
        
        // Make the game canvas pass through clicks to underlying elements
        this.game.canvas.style.pointerEvents = 'none';
        
        // Add a transparent overlay that will capture clicks
        this.overlay = document.createElement('div');
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100%';
        this.overlay.style.height = '100%';
        this.overlay.style.zIndex = '10';
        this.overlay.style.pointerEvents = 'auto';
        this.overlay.style.cursor = 'default';
        
        // Add overlay to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(this.overlay);
        }
    }

    createAnimations() {
        // Idle animations
        this.anims.create({
            key: 'idle-right',
            frames: this.anims.generateFrameNumbers('ash', {
                start: 0,
                end: 5,
            }),
            repeat: -1,
            frameRate: 15,
        });

        this.anims.create({
            key: 'idle-up',
            frames: this.anims.generateFrameNumbers('ash', {
                start: 6,
                end: 11,
            }),
            repeat: -1,
            frameRate: 15,
        });

        this.anims.create({
            key: 'idle-left',
            frames: this.anims.generateFrameNumbers('ash', {
                start: 12,
                end: 17,
            }),
            repeat: -1,
            frameRate: 15
        });

        this.anims.create({
            key: 'idle-down',
            frames: this.anims.generateFrameNumbers('ash', {
                start: 18,
                end: 23,
            }),
            repeat: -1,
            frameRate: 15,
        });

        // Walk animations
        this.anims.create({
            key: "walk-right",
            frames: this.anims.generateFrameNumbers("ash", { start: 24, end: 29 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "walk-up",
            frames: this.anims.generateFrameNumbers("ash", { start: 30, end: 35 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "walk-left",
            frames: this.anims.generateFrameNumbers("ash", { start: 36, end: 41 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "walk-down",
            frames: this.anims.generateFrameNumbers("ash", { start: 42, end: 47 }),
            frameRate: 15,
            repeat: -1
        });
    }

    setupInputHandlers() {
        // Listen for game input events
        this.events.on('gameInput', (input) => {
            this.handleGameInput(input);
        });
    }
    
    handleGameInput(input) {
        const { type, action, data } = input;
        
        if (type === 'keydown') {
            switch (action) {
                case 'MOVE_UP':
                    this.movement.up = true;
                    break;
                case 'MOVE_DOWN':
                    this.movement.down = true;
                    break;
                case 'MOVE_LEFT':
                    this.movement.left = true;
                    break;
                case 'MOVE_RIGHT':
                    this.movement.right = true;
                    break;
                case 'INTERACT':
                    this.handleInteraction();
                    break;
            }
        } else if (type === 'keyup') {
            switch (action) {
                case 'MOVE_UP':
                    this.movement.up = false;
                    break;
                case 'MOVE_DOWN':
                    this.movement.down = false;
                    break;
                case 'MOVE_LEFT':
                    this.movement.left = false;
                    break;
                case 'MOVE_RIGHT':
                    this.movement.right = false;
                    break;
            }
        }
    }
    
    handleInteraction() {
        // Implement interaction logic here
        console.log("Player interaction");
    }

    addOtherPlayer(id, data) {
        console.log("Adding other player:", id, data);
        const other = this.add.sprite(data.x, data.y, "ash")
            .setTint(0xff0000)
            .setScale(1.5);
        
        // Set initial animation if provided
        if (data.anim) {
            other.anims.play(data.anim, true);
        } else {
            other.setFrame(18); // Default idle-down frame
        }
        
        this.players[id] = other;
    }

    update() {
        // Don't process movement if chat is focused
        if (this.inputManager.chatFocused) {
            // Reset movement state when chat is focused
            this.movement = {
                up: false,
                down: false,
                left: false,
                right: false
            };
            // Play idle animation when chat is focused
            this.currentAnimation = `idle-${this.lastDirection}`;
            this.player.anims.play(this.currentAnimation, true);
            return;
        }
        
        const speed = 200;
        const delta = this.game.loop.delta / 1000;

        let dx = 0, dy = 0;
        if (this.movement.left) dx = -1;
        if (this.movement.right) dx = 1;
        if (this.movement.up) dy = -1;
        if (this.movement.down) dy = 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707; // 1/sqrt(2)
            dy *= 0.707;
        }

        // Handle movement and animations
        if (dx !== 0 || dy !== 0) {
            this.player.x += dx * speed * delta;
            this.player.y += dy * speed * delta;

            // Play appropriate walk animation based on direction
            if (this.movement.left) {
                this.currentAnimation = "walk-left";
                this.lastDirection = "left";
            } else if (this.movement.right) {
                this.currentAnimation = "walk-right";
                this.lastDirection = "right";
            } else if (this.movement.up) {
                this.currentAnimation = "walk-up";
                this.lastDirection = "up";
            } else if (this.movement.down) {
                this.currentAnimation = "walk-down";
                this.lastDirection = "down";
            }
            
            this.player.anims.play(this.currentAnimation, true);
        } else {
            // Play idle animation when not moving
            this.currentAnimation = `idle-${this.lastDirection}`;
            this.player.anims.play(this.currentAnimation, true);
        }
    }
    
    destroy() {
        // Clean up interval
        if (this.positionUpdateInterval) {
            clearInterval(this.positionUpdateInterval);
        }
        
        // Remove overlay
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        // Restore canvas pointer events
        if (this.game.canvas) {
            this.game.canvas.style.pointerEvents = 'auto';
        }
        
        super.destroy();
    }
}
