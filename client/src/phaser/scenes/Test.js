// Phaser/scenes/TestScene.js
import Phaser from "phaser";

export default class TestScene extends Phaser.Scene {
    constructor() {
        super("TestScene");
    }

    preload() {
        // Load character sprite sheet
        this.load.spritesheet("ash", "/assets/characters/ash.png", {
            frameWidth: 32,
            frameHeight: 48
        });

        // (Optional) load background
        this.load.image("background", "/assets/steptodown.com169408.jpg");
    }

    create() {
        // (Optional) add background
        this.add.image(400, 300, "background").setScale(1);

        // Create player sprite
        this.player = this.physics.add.sprite(400, 300, "ash");

        // Prevent player from going outside bounds
        this.player.setCollideWorldBounds(true);

        // Define animations based on the sprite sheet layout
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

        // Set default frame
        this.player.setFrame(18);

        // Store last direction for idle animations
        this.lastDirection = "down";

        // Create input handler for arrow keys
        this.cursors = this.input.keyboard.createCursorKeys();

        // Add WASD keys support
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
    }

    update() {
        const speed = 100;
        const player = this.player;
        const cursors = this.cursors;
        const wasd = this.wasd;

        // Stop movement before checking input
        player.setVelocity(0);

        // Check input and play appropriate animations
        // Support both arrow keys and WASD
        if (cursors.left.isDown || wasd.left.isDown) {
            player.setVelocityX(-speed);
            player.anims.play("walk-left", true);
            this.lastDirection = "left";
        } else if (cursors.right.isDown || wasd.right.isDown) {
            player.setVelocityX(speed);
            player.anims.play("walk-right", true);
            this.lastDirection = "right";
        } else if (cursors.up.isDown || wasd.up.isDown) {
            player.setVelocityY(-speed);
            player.anims.play("walk-up", true);
            this.lastDirection = "up";
        } else if (cursors.down.isDown || wasd.down.isDown) {
            player.setVelocityY(speed);
            player.anims.play("walk-down", true);
            this.lastDirection = "down";
        } else {
            // Play idle animation based on last direction when no keys are pressed
            player.anims.play(`idle-${this.lastDirection}`, true);
        }
    }
}
