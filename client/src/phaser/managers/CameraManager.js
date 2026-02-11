
import Phaser from "phaser";

export default class CameraManager {
    constructor(scene) {
        this.scene = scene;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.camStart = { x: 0, y: 0 };
        this.followTarget = null;
    }

    create(mapWidth, mapHeight) {
        const cam = this.scene.cameras.main;
        cam.setBounds(0, 0, mapWidth, mapHeight);

        // Initial Zoom
        if (this.isMobileDevice()) {
            cam.setZoom(1.0);
        } else {
            cam.setZoom(1.5);
        }

        this.setupInputs();
        this.setupUIListeners();
    }

    isMobileDevice() {
        const device = this.scene.sys.game.device;
        const smallScreen = window.innerWidth <= 768;
        return !device.os.desktop || smallScreen;
    }

    startFollow(target) {
        this.followTarget = target;
        this.scene.cameras.main.startFollow(target);
    }

    stopFollow() {
        this.scene.cameras.main.stopFollow();
    }

    setupInputs() {
        const cam = this.scene.cameras.main;

        // Mouse Drag to Pan
        this.scene.input.on('pointerdown', (pointer) => {
            // Only left click (0) and ensure we are not on UI if that was checked elsewhere,
            // but here we just check button.
            if (pointer.button === 0) {
                this.stopFollow();
                this.isDragging = true;
                this.dragStart.x = pointer.x;
                this.dragStart.y = pointer.y;
                this.camStart.x = cam.scrollX;
                this.camStart.y = cam.scrollY;
                this.scene.input.setDefaultCursor('grabbing');
            }
        });

        this.scene.input.on('pointermove', (pointer) => {
            if (this.isDragging) {
                if (!pointer.isDown) {
                    this.isDragging = false;
                    this.scene.input.setDefaultCursor('default');
                    return;
                }
                const zoom = cam.zoom;
                // Calculate diff in WORLD units
                const diffX = (pointer.x - this.dragStart.x) / zoom;
                const diffY = (pointer.y - this.dragStart.y) / zoom;

                cam.scrollX = this.camStart.x - diffX;
                cam.scrollY = this.camStart.y - diffY;
            }
        });

        this.scene.input.on('pointerup', () => {
            this.isDragging = false;
            this.scene.input.setDefaultCursor('default');
        });

        this.scene.input.on('pointerout', () => {
            this.isDragging = false;
            this.scene.input.setDefaultCursor('default');
        });

        // Wheel Zoom
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.adjustZoom(deltaY > 0 ? -0.3 : 0.3);
        });
    }

    setupUIListeners() {
        if (window._zoomInHandler) window.removeEventListener('zoom-in', window._zoomInHandler);
        if (window._zoomOutHandler) window.removeEventListener('zoom-out', window._zoomOutHandler);

        window._zoomInHandler = () => this.adjustZoom(0.3);
        window._zoomOutHandler = () => this.adjustZoom(-0.3);

        window.addEventListener('zoom-in', window._zoomInHandler);
        window.addEventListener('zoom-out', window._zoomOutHandler);

        // Clean up on scene destroy? The manager instance might persist or is recreated.
        // It's better to unbind in a cleanup/destroy method.
        this.scene.events.on('destroy', this.destroy, this);
    }

    adjustZoom(amount) {
        const cam = this.scene.cameras.main;
        let newZoom = cam.zoom + amount;
        newZoom = Phaser.Math.Clamp(newZoom, 0.5, 3.0);
        cam.zoomTo(newZoom, 100, 'Linear', true);
    }

    destroy() {
        if (window._zoomInHandler) window.removeEventListener('zoom-in', window._zoomInHandler);
        if (window._zoomOutHandler) window.removeEventListener('zoom-out', window._zoomOutHandler);
    }

    update() {
        // Handled by World scene calling checkResumeFollow
    }

    checkResumeFollow(dx, dy) {
        // If we are dragging map, do not resume
        if (this.isDragging) return;

        // If player moves (dx or dy != 0), resume follow
        // This gives a nice "snap back" effect when you move after looking around
        if ((dx !== 0 || dy !== 0) && this.followTarget) {
            this.scene.cameras.main.startFollow(this.followTarget);
        }
    }
}
