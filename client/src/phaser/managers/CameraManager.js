
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
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;

        const cam = this.scene.cameras.main;
        cam.roundPixels = true;
        cam.setBounds(0, 0, mapWidth, mapHeight);

        // Initial Zoom Logic
        this.updateMinZoom(); // Calculate limit first
        let startZoom = this.isMobileDevice() ? 1.0 : 1.5;
        startZoom = Math.max(startZoom, this.minZoom); // Enforce limit

        cam.setZoom(startZoom);

        this.setupInputs();
        this.setupUIListeners();

        // Listen for resize to update limits
        this.scene.scale.on('resize', this.onResize, this);
    }

    onResize(gameSize) {
        this.updateMinZoom();
        // Force re-clamp current zoom
        const cam = this.scene.cameras.main;
        if (cam.zoom < this.minZoom) {
            cam.setZoom(this.minZoom);
        }
    }

    updateMinZoom() {
        if (!this.mapWidth || !this.mapHeight) return;

        const cam = this.scene.cameras.main;
        // Calculate the zoom level where the viewport fits exactly inside the map
        const minZoomX = cam.width / this.mapWidth;
        const minZoomY = cam.height / this.mapHeight;

        // We must be zoomed in enough so NEITHER dimension shows white space
        // So we take the MAX of the required zooms
        this.minZoom = Math.max(minZoomX, minZoomY);

        // Safety: If map is smaller than screen, minZoom might be > 1. 
        // If map is huge, minZoom is small (e.g. 0.2).
        // Let's cap max zoom at 3.0 as before.
    }

    isMobileDevice() {
        const device = this.scene.sys.game.device;
        const smallScreen = window.innerWidth <= 768;
        return !device.os.desktop || smallScreen;
    }

    startFollow(target) {
        this.followTarget = target;
        this.scene.cameras.main.startFollow(target, true);
    }

    stopFollow() {
        this.scene.cameras.main.stopFollow();
    }

    setupInputs() {
        const cam = this.scene.cameras.main;

        // Mouse Drag ... (existing code logic is fine, but let's just replace the wheel part here or reuse existing)
        // ... (I will keep your existing input setup mostly, but update the Wheel part)

        this.scene.input.on('pointerdown', (pointer) => {
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
            // Determine direction
            const direction = deltaY > 0 ? -1 : 1;
            const zoomAmount = 0.1 * direction; // Smoother steps

            let newZoom = cam.zoom + zoomAmount;

            // Clamp
            newZoom = Phaser.Math.Clamp(newZoom, this.minZoom, 3.0);

            cam.setZoom(newZoom);
        });
    }

    setupUIListeners() {
        if (window._zoomInHandler) window.removeEventListener('zoom-in', window._zoomInHandler);
        if (window._zoomOutHandler) window.removeEventListener('zoom-out', window._zoomOutHandler);

        window._zoomInHandler = () => this.adjustZoom(0.3);
        window._zoomOutHandler = () => this.adjustZoom(-0.3);

        window.addEventListener('zoom-in', window._zoomInHandler);
        window.addEventListener('zoom-out', window._zoomOutHandler);

        this.scene.events.on('destroy', this.destroy, this);
    }

    adjustZoom(amount) {
        const cam = this.scene.cameras.main;
        let newZoom = cam.zoom + amount;

        // Use this.minZoom instead of hardcoded 0.5
        newZoom = Phaser.Math.Clamp(newZoom, this.minZoom, 3.0);

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
