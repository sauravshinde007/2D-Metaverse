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
        this.load.image(
            "player",
            "https://labs.phaser.io/assets/sprites/phaser-dude.png"
        );
    }

    create() {
        this.socket = io("http://localhost:3001");

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

        // ✅ spawn local player
        this.player = this.add.sprite(400, 300, "player");

        // ✅ camera follows local player
        this.cameras.main.startFollow(this.player);

        // Initialize input manager
        this.inputManager = new InputManager(this);
        
        // Set up game input listeners
        this.setupInputHandlers();

        // listen for all players
        this.socket.on("players", (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) {
                    this.addOtherPlayer(id, players[id]);
                }
            });
        });

        // when a new player moves
        this.socket.on("playerMoved", ({ id, pos }) => {
            if (this.players[id]) {
                this.players[id].x = pos.x;
                this.players[id].y = pos.y;
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
        
        // Send position updates at a fixed interval
        this.positionUpdateInterval = setInterval(() => {
            if (Object.values(this.movement).some(v => v)) {
                this.socket.emit("move", { x: this.player.x, y: this.player.y });
            }
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

    addOtherPlayer(id, pos) {
        const other = this.add.sprite(pos.x, pos.y, "player").setTint(0xff0000);
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

        if (dx !== 0 || dy !== 0) {
            this.player.x += dx * speed * delta;
            this.player.y += dy * speed * delta;
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