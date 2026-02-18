
import Phaser from "phaser";

export default class PlayerManager {
    constructor(scene, inputManager, mapManager) {
        this.scene = scene;
        this.inputManager = inputManager;
        this.mapManager = mapManager;

        this.player = null; // Local player sprite
        this.playerUsernameText = null;

        this.players = {}; // Remote player containers
        this.playerUsernames = new Map(); // id -> username

        this.movement = { up: false, down: false, left: false, right: false };
        this.lastDirection = "down";
        this.currentAnimation = "idle-down";

        // Joystick
        this.joystickBase = null;
        this.joystickThumb = null;
        this.joystickActive = false;
        this.joystickDirection = { up: false, down: false, left: false, right: false };

        this.currentZoneId = null;

        // Interaction UI
        this.interactionText = null;
        // Interaction UI
        this.interactionText = null;
        this.currentInteractable = null;

        this.isInMeeting = false;

        // Events
        this.scene.events.on("gameInput", (input) => this.handleGameInput(input));
        window.addEventListener("meeting-status-change", (e) => {
            this.isInMeeting = e.detail.active;
            console.log("Meeting status changed. Active:", this.isInMeeting);
        });
    }

    createAnimations() {
        const anims = this.scene.anims;
        // Idle
        anims.create({ key: "idle-right", frames: anims.generateFrameNumbers("ash", { start: 0, end: 5 }), repeat: -1, frameRate: 15 });
        anims.create({ key: "idle-up", frames: anims.generateFrameNumbers("ash", { start: 6, end: 11 }), repeat: -1, frameRate: 15 });
        anims.create({ key: "idle-left", frames: anims.generateFrameNumbers("ash", { start: 12, end: 17 }), repeat: -1, frameRate: 15 });
        anims.create({ key: "idle-down", frames: anims.generateFrameNumbers("ash", { start: 18, end: 23 }), repeat: -1, frameRate: 15 });
        // Walk
        anims.create({ key: "walk-right", frames: anims.generateFrameNumbers("ash", { start: 24, end: 29 }), frameRate: 10, repeat: -1 });
        anims.create({ key: "walk-up", frames: anims.generateFrameNumbers("ash", { start: 30, end: 35 }), frameRate: 10, repeat: -1 });
        anims.create({ key: "walk-left", frames: anims.generateFrameNumbers("ash", { start: 36, end: 41 }), frameRate: 10, repeat: -1 });
        anims.create({ key: "walk-down", frames: anims.generateFrameNumbers("ash", { start: 42, end: 47 }), frameRate: 15, repeat: -1 });

        anims.create({ key: "sit-down", frames: [{ key: "ash", frame: 48 }], frameRate: 1 });
        anims.create({ key: "sit-left", frames: [{ key: "ash", frame: 49 }], frameRate: 1 });
        anims.create({ key: "sit-right", frames: [{ key: "ash", frame: 50 }], frameRate: 1 });
        anims.create({ key: "sit-up", frames: [{ key: "ash", frame: 51 }], frameRate: 1 });
    }

    createLocalPlayer(x, y, username) {

        this.player = this.scene.physics.add.sprite(x, y, "ash");

        // Glow
        const localGlow = this.player.preFX.addGlow(0xffffff, 4, 0, false, 0.1, 10);
        localGlow.setActive(false);
        this.player.setInteractive();
        this.player.on('pointerover', () => localGlow.setActive(true));
        this.player.on('pointerout', () => localGlow.setActive(false));

        this.player.setDepth(5);
        this.player.setCollideWorldBounds(true);

        // Colliders
        if (this.mapManager.layers.walls) this.scene.physics.add.collider(this.player, this.mapManager.layers.walls);
        if (this.mapManager.layers.props) this.scene.physics.add.collider(this.player, this.mapManager.layers.props);

        this.createMobileJoystick();
    }

    addOtherPlayer(id, data) {
        if (this.players[id]) this.players[id].destroy();

        const sprite = this.scene.add.sprite(0, 0, "ash");
        const container = this.scene.add.container(data.x, data.y, [sprite]);

        // Glow
        const remoteGlow = sprite.preFX.addGlow(0xffffff, 4, 0, false, 0.1, 10);
        remoteGlow.setActive(false);
        sprite.setInteractive();
        sprite.on('pointerover', () => remoteGlow.setActive(true));
        sprite.on('pointerout', () => remoteGlow.setActive(false));

        container.setDepth(5);
        if (data.anim) sprite.anims.play(data.anim, true);
        else sprite.setFrame(18);

        this.players[id] = container;
        this.playerUsernames.set(id, data.username);
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].destroy();
            delete this.players[id];
            this.playerUsernames.delete(id);
        }
    }

    moveRemotePlayer(id, pos, anim) {
        const container = this.players[id];
        if (container) {
            this.scene.tweens.add({
                targets: container,
                x: pos.x,
                y: pos.y,
                duration: 120,
                ease: "Linear",
            });
            const sprite = container.getAt(0);
            if (anim && sprite.anims) sprite.anims.play(anim, true);
        }
    }

    handleGameInput(input) {
        const { type, action } = input;
        const isDown = type === "keydown";

        switch (action) {
            case "MOVE_UP": this.movement.up = isDown; break;
            case "MOVE_DOWN": this.movement.down = isDown; break;
            case "MOVE_LEFT": this.movement.left = isDown; break;
            case "MOVE_RIGHT": this.movement.right = isDown; break;
            case "INTERACT":
                if (isDown) {
                    console.log("Player interaction");
                    this.handleInteraction();
                }
                break;
        }
    }

    handleInteraction() {
        if (!this.player) return;
        const interactable = this.currentInteractable; // Use tracked interactable from update loop

        if (interactable) {
            console.log("Interact with:", interactable);

            // 1. Chairs in Meeting Rooms -> Trigger Meeting
            if (interactable.type === 'chair') {
                // Determine facing direction from custom property "dir" or "direction" set in Tiled
                // If not set, default to 'up' or 'down' based on chair position?
                // Tiled Property: "dir" : "up" | "down" | "left" | "right"
                const dirProp = interactable.rawProperties && interactable.rawProperties.find(p => p.name === "dir");
                const direction = dirProp ? dirProp.value : "down";

                // Play Sitting Animation
                if (this.player && this.player.anims) {
                    this.player.anims.play(`sit-${direction}`, true);
                    this.player.body.setVelocity(0); // Stop movement
                    this.currentAnimation = `sit-${direction}`; // Lock animation
                }

                // Align position to center of chair
                this.player.x = interactable.x + interactable.width / 2;
                this.player.y = interactable.y + interactable.height / 2 - 10; // Offset slightly for visual depth

                // Ensure we are logically in a meeting room zone
                if (this.currentZoneId && this.currentZoneId.startsWith('meeting_room')) {
                    window.dispatchEvent(new CustomEvent('enter-meeting-zone', {
                        detail: {
                            zoneId: this.currentZoneId,
                            zoneName: "Meeting Room"
                        }
                    }));
                }
            }

            // 2. Computers -> Trigger Computer UI (Placeholder)
            else if (interactable.type === 'computer') {
                console.log("🖥️ Computer interaction triggered");
                // window.dispatchEvent(new CustomEvent('open-computer', { ... }));
            }
        }
    }

    update(myRole) {
        if (!this.player || !this.player.body) return;

        // Meeting or Chat Focus check
        if (this.inputManager.chatFocused || this.isInMeeting) {
            this.player.body.setVelocity(0);
            return;
        }

        // RBAC Check
        const access = this.mapManager.checkZoneAccess(this.player, myRole);
        this.mapManager.updateImmersion(access.zone);

        if (!access.allowed && access.zone) {
            const zone = access.zone;
            const centerX = zone.x + zone.width / 2;
            const centerY = zone.y + zone.height / 2;
            const angle = Phaser.Math.Angle.Between(centerX, centerY, this.player.x, this.player.y);
            this.player.x += Math.cos(angle) * 5;
            this.player.y += Math.sin(angle) * 5;
            this.showAccessDenied(zone.name);
        } else {
            // Access allowed. Check if zone changed.
            const newZoneId = access.zone ? access.zone.id : null;

            if (newZoneId !== this.currentZoneId) {
                // Leaving previous zone
                if (this.currentZoneId && this.currentZoneId.startsWith('meeting_room')) {
                    window.dispatchEvent(new CustomEvent('leave-meeting-zone', { detail: { zoneId: this.currentZoneId } }));
                }

                // Entering new zone logic removed - wait for Interaction
                this.currentZoneId = newZoneId;
            }
        }

        // Movement
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

        // Resume Camera Follow if moving
        if (dx !== 0 || dy !== 0) {
            this.scene.cameraManager.checkResumeFollow(dx, dy);
        }

        // Animation
        if (this.currentAnimation.startsWith('sit-')) {
            // If dragging joystick or pressing keys, break out of sit
            if (this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0) {
                // Moving, so let normal logic take over
            } else {
                // Still sitting, do not override
                return;
            }
        }

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

        // Update React Labels (New)
        this.updatePlayerLabels();

        // Limit Minimap Updates (10fps is enough)
        const now = Date.now();
        if (!this.lastMinimapUpdate || now - this.lastMinimapUpdate > 100) {
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
            this.lastMinimapUpdate = now;
        }

        // Limit Interaction UI Updates (10fps is enough)
        if (!this.lastInteractionUpdate || now - this.lastInteractionUpdate > 100) {
            this.updateInteractionUI();
            this.lastInteractionUpdate = now;
        }
    }

    updatePlayerLabels() {
        if (!this.player) return;

        const camera = this.scene.cameras.main;
        const labels = [];

        // Helper to project world to screen
        // We calculate relative to canvas DOM element
        const getScreenPos = (wx, wy) => {
            // worldView check
            if (!camera.worldView.contains(wx, wy)) return null;

            // Convert to screen
            // (WorldX - CameraScrollX) * Zoom = ScreenX
            // Note: If roundPixels is on, we might want to floor this manually?
            // Actually, for CSS transform, float is fine, browser handles subpixel reflow.
            const sx = (wx - camera.worldView.x) * camera.zoom;
            const sy = (wy - camera.worldView.y) * camera.zoom;
            return { x: sx, y: sy };
        };

        // 1. Local Player
        const localPos = getScreenPos(this.player.x, this.player.y);
        if (localPos) {
            labels.push({
                id: 'me',
                username: 'You',
                x: localPos.x + (5 * camera.zoom),
                y: localPos.y - (25 * camera.zoom), // Offset scaled by zoom
                isLocal: true
            });
        }

        // 2. Remote Players
        // this.players[id] is a Container {x, y, list...}
        Object.keys(this.players).forEach(id => {
            const container = this.players[id];
            const pos = getScreenPos(container.x, container.y);
            if (pos) {
                const username = this.playerUsernames.get(id) || "Player";
                labels.push({
                    id: id,
                    username: username,
                    x: pos.x + (5 * camera.zoom),
                    y: pos.y - (25 * camera.zoom),
                    isLocal: false
                });
            }
        });

        // Dispatch efficient event
        // We use a custom event on window
        window.dispatchEvent(new CustomEvent('player-labels-update', {
            detail: labels
        }));
    }

    updateInteractionUI() {
        if (!this.player) return;

        // Check constantly for nearby interaction
        const interactable = this.mapManager.getNearestInteractable(this.player.x, this.player.y);

        // Show/Hide prompt
        if (interactable) {
            if (!this.interactionText) {
                this.interactionText = this.scene.add.text(0, 0, "Press E to Interact", {
                    fontFamily: 'Inter',
                    fontSize: '12px',
                    backgroundColor: '#000000aa',
                    padding: { x: 6, y: 4 },
                    fill: '#ffffff'
                }).setOrigin(0.5).setDepth(200).setResolution(2);
            }

            // Position above player (or object?)
            // Let's position it above the object to attract attention
            this.interactionText.setPosition(interactable.x + interactable.width / 2, interactable.y - 20);
            this.interactionText.setVisible(true);
            this.currentInteractable = interactable;
        } else {
            if (this.interactionText) {
                this.interactionText.setVisible(false);
            }
            this.currentInteractable = null;
        }
    }

    stopAnimation() {
        this.movement = { up: false, down: false, left: false, right: false };
        const idleAnim = `idle-${this.lastDirection}`;
        if (this.currentAnimation !== idleAnim) {
            this.currentAnimation = idleAnim;
            this.player.anims.play(this.currentAnimation, true);
        }
    }

    showAccessDenied(zoneName) {
        if (this._lastWarning && Date.now() - this._lastWarning < 1000) return;
        this._lastWarning = Date.now();

        const toast = this.scene.add.text(this.player.x, this.player.y - 60, `🔒 Access to ${zoneName} Denied`, {
            fontFamily: 'Inter',
            fontSize: '16px', fontStyle: 'bold',
            fill: '#ff0000', stroke: '#ffffff', strokeThickness: 4,
            backgroundColor: '#00000088',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(100).setResolution(2);

        this.scene.tweens.add({
            targets: toast,
            y: toast.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => toast.destroy()
        });
    }

    showReaction(targetSprite, emoji) {
        if (!targetSprite) return;
        const x = targetSprite.x;
        const y = targetSprite.y - 50;

        const emojiText = this.scene.add.text(x, y, emoji, {
            fontFamily: 'Inter', fontSize: "32px",
        }).setOrigin(0.5).setDepth(100).setResolution(2);

        this.scene.tweens.add({
            targets: emojiText,
            y: y - 40,
            alpha: 0,
            duration: 2000,
            ease: "Power1",
            onComplete: () => emojiText.destroy()
        });
    }

    // --- Mobile Joystick ---
    isMobileDevice() {
        const device = this.scene.sys.game.device;
        const smallScreen = window.innerWidth <= 768;
        return !device.os.desktop || smallScreen;
    }

    createMobileJoystick() {
        if (!this.isMobileDevice()) return;

        const radius = 50;
        const thumbRadius = 25;
        this.joystickBase = this.scene.add.circle(0, 0, radius, 0x000000, 0.25).setScrollFactor(0).setDepth(1000).setVisible(false);
        this.joystickThumb = this.scene.add.circle(0, 0, thumbRadius, 0xffffff, 0.7).setScrollFactor(0).setDepth(1001).setVisible(false);

        this.scene.input.on("pointerdown", (pointer) => {
            if (!this.isMobileDevice() || this.inputManager.chatFocused) return;
            if (pointer.x > this.scene.cameras.main.width / 2) return;

            this.joystickActive = true;
            this.joystickBase.setPosition(pointer.x, pointer.y).setVisible(true);
            this.joystickThumb.setPosition(pointer.x, pointer.y).setVisible(true);
            this.updateJoystick(pointer);
        });

        this.scene.input.on("pointermove", (pointer) => {
            if (this.joystickActive) this.updateJoystick(pointer);
        });

        this.scene.input.on("pointerup", () => {
            if (this.joystickActive) {
                this.joystickActive = false;
                this.joystickBase.setVisible(false);
                this.joystickThumb.setVisible(false);
                this.applyJoystickDir({ up: false, down: false, left: false, right: false });
            }
        });
    }

    updateJoystick(pointer) {
        const baseX = this.joystickBase.x;
        const baseY = this.joystickBase.y;
        const dx = pointer.x - baseX;
        const dy = pointer.y - baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 60;

        let offsetX = dx, offsetY = dy;
        if (dist > maxDist) {
            const scale = maxDist / dist;
            offsetX = dx * scale;
            offsetY = dy * scale;
        }
        this.joystickThumb.setPosition(baseX + offsetX, baseY + offsetY);

        const deadZone = 10;
        if (dist < deadZone) {
            this.applyJoystickDir({ up: false, down: false, left: false, right: false });
            return;
        }

        const dir = { up: false, down: false, left: false, right: false };
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -deadZone) dir.left = true;
            else if (dx > deadZone) dir.right = true;
        } else {
            if (dy < -deadZone) dir.up = true;
            else if (dy > deadZone) dir.down = true;
        }
        this.applyJoystickDir(dir);
    }

    applyJoystickDir(newDir) {
        const prev = this.joystickDirection;
        const emit = (type, action) => {
            this.handleGameInput({ type, action });
        };

        if (newDir.up && !prev.up) emit("keydown", "MOVE_UP");
        if (!newDir.up && prev.up) emit("keyup", "MOVE_UP");
        if (newDir.down && !prev.down) emit("keydown", "MOVE_DOWN");
        if (!newDir.down && prev.down) emit("keyup", "MOVE_DOWN");
        if (newDir.left && !prev.left) emit("keydown", "MOVE_LEFT");
        if (!newDir.left && prev.left) emit("keyup", "MOVE_LEFT");
        if (newDir.right && !prev.right) emit("keydown", "MOVE_RIGHT");
        if (!newDir.right && prev.right) emit("keyup", "MOVE_RIGHT");

        this.joystickDirection = newDir;
    }
}
