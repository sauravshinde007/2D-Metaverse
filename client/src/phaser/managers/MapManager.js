
import Phaser from "phaser";

export default class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.map = null;
        this.layers = {};
        this.restrictedZones = []; // { id, x, y, width, height, name }
        this.roomAccessRules = {};
        this.zoneGraphics = null;

        // Bounds
        this.width = 0;
        this.height = 0;

        // Spawn Point (Default to previous hardcoded value if missing)
        this.spawnPoint = { x: 1162, y: 1199 };
    }

    create() {
        this.map = this.scene.make.tilemap({ key: "office-map" });

        // Tilesets
        const roomTileset = this.map.addTilesetImage("Room_Builder_free_32x32", "room-tiles");
        const interiorTileset = this.map.addTilesetImage("Interiors_free_32x32", "interior-tiles");
        const officeTileset = this.map.addTilesetImage("Modern_Office_Black_Shadow", "office-tiles");
        const roomfloorTileset = this.map.addTilesetImage("Room_Builder_Floors", "room-floor");
        const allTilesets = [interiorTileset, roomTileset, officeTileset, roomfloorTileset];

        // Layers - Safely attempt to create them (returns null if missing in Tiled)
        this.layers.ground = this.map.createLayer("Ground", allTilesets, 0, 0);
        this.layers.walls = this.map.createLayer("Wall", allTilesets, 0, 0);
        this.layers.props = this.map.createLayer("Props", allTilesets, 0, 0);
        this.layers.props1 = this.map.createLayer("Props1", allTilesets, 0, 0);
        this.layers.props2 = this.map.createLayer("Props2", allTilesets, 0, 0);
        this.layers.props3 = this.map.createLayer("Props3", allTilesets, 0, 0);

        // Depth & Collisions - Only handle if layer exists
        if (this.layers.ground) this.layers.ground.setDepth(0);

        if (this.layers.walls) {
            this.layers.walls.setDepth(1);
            this.layers.walls.setCollisionByProperty({ collides: true });
        }

        if (this.layers.props) {
            this.layers.props.setDepth(2);
            this.layers.props.setCollisionByProperty({ collides: true });
        }

        if (this.layers.props1) {
            this.layers.props1.setDepth(3);
            this.layers.props1.setCollisionByProperty({ collides: true });
        }

        if (this.layers.props2) {
            this.layers.props2.setDepth(4);
            this.layers.props2.setCollisionByProperty({ collides: true });
        }

        if (this.layers.props3) {
            this.layers.props3.setDepth(5);
            this.layers.props3.setCollisionByProperty({ collides: true });
        }

        // World bounds
        this.width = this.map.widthInPixels;
        this.height = this.map.heightInPixels;

        this.scene.physics.world.setBounds(0, 0, this.width, this.height);

        // Dispatch map size to React for UI Minimap
        window.dispatchEvent(new CustomEvent('map-init', {
            detail: { width: this.width, height: this.height }
        }));

        // Initialize RBAC Zones
        this.createRestrictedZones();
        this.findSpawnPoint();
    }

    registerRaycaster(raycasterPlugin) {
        if (raycasterPlugin) {
            const collisionLayers = [
                this.layers.walls,
                this.layers.props,
                this.layers.props1,
                this.layers.props2,
                this.layers.props3
            ].filter(layer => layer != null); // Only include existing layers

            raycasterPlugin.mapGameObjects(collisionLayers, true);
            console.log("✅ Raycaster mapped to collision layers", collisionLayers.length);
        }
    }

    findSpawnPoint() {
        console.log("🔍 Searching for Spawn Point...");

        // Debug: Log all object layers found
        if (this.map.objects) {
            const layerNames = Object.keys(this.map.objects);
            console.log("📂 Available Object Layers:", layerNames);
        }

        const spawnLayer = this.map.getObjectLayer("Spawn");

        if (!spawnLayer) {
            console.warn("⚠️ 'Spawn' Object Layer NOT found in map. Did you name it exactly 'Spawn'?");
            return;
        }

        console.log("✅ 'Spawn' Layer found. Objects inside:", spawnLayer.objects);

        if (spawnLayer.objects) {
            const spawnObj = spawnLayer.objects.find(obj => obj.name === "SpawnPoint");
            if (spawnObj) {
                this.spawnPoint = { x: spawnObj.x, y: spawnObj.y };
                console.log("📍 Spawn point found at:", this.spawnPoint);
            } else {
                console.warn("⚠️ Layer 'Spawn' exists but no object named 'SpawnPoint' found inside it.");
            }
        }
    }

    // 🔒 RBAC Methods
    createRestrictedZones() {
        // 1. Try to load from Tiled Map Object Layer
        const zoneLayer = this.map.getObjectLayer("Zones");
        this.restrictedZones = []; // Reset

        if (zoneLayer && zoneLayer.objects) {
            console.log("🗺️ Loading Restricted Zones from Tiled Map...");

            zoneLayer.objects.forEach((obj) => {
                // Tiled objects usually have properties array. We look for 'zoneId' custom property.
                const idProp = obj.properties && obj.properties.find(p => p.name === "zoneId");
                const zoneId = idProp ? idProp.value : obj.name;

                // Also look for a 'name' property for display
                const nameProp = obj.properties && obj.properties.find(p => p.name === "zoneName");
                const zoneName = nameProp ? nameProp.value : (obj.name || zoneId);

                this.restrictedZones.push({
                    id: zoneId,
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height,
                    name: zoneName,
                });
            });
            console.log("✅ Loaded Zones:", this.restrictedZones);
        }

        // Draw them
        this.zoneGraphics = this.scene.add.graphics();
        this.zoneGraphics.setDepth(0); // On ground
        this.updateZoneVisuals();

        // Create text labels for zones
        this.restrictedZones.forEach(zone => {
            const text = this.scene.add.text(zone.x + zone.width / 2, zone.y - 10, zone.name, {
                fontFamily: 'Inter',
                fontSize: '12px', fill: '#ffffff', backgroundColor: '#000000aa'
            })
                .setOrigin(0.5)
                .setResolution(2);

            text.setDepth(10);
        });
    }

    updateZoneVisuals(myRole = 'employee') {
        if (!this.zoneGraphics) return;
        this.zoneGraphics.clear();

        this.restrictedZones.forEach(zone => {
            const allowedRoles = this.roomAccessRules[zone.id] || [];
            const canAccess = allowedRoles.includes(myRole);

            const color = canAccess ? 0x00ff00 : 0xff0000;
            const alpha = 0.3;

            this.zoneGraphics.fillStyle(color, alpha);
            this.zoneGraphics.fillRect(zone.x, zone.y, zone.width, zone.height);

            // Border
            this.zoneGraphics.lineStyle(2, color, 1);
            this.zoneGraphics.strokeRect(zone.x, zone.y, zone.width, zone.height);
        });
    }

    setRoomAccessRules(rules, myRole) {
        this.roomAccessRules = rules;
        this.updateZoneVisuals(myRole);
    }

    // Returns true if player is allowed, false if denied (and handles bounce/warning)
    checkZoneAccess(player, myRole) {
        if (!player) return true;

        const px = player.x;
        const py = player.y;

        for (const zone of this.restrictedZones) {
            const inZone = (px > zone.x && px < zone.x + zone.width &&
                py > zone.y && py < zone.y + zone.height);

            if (inZone) {
                const allowedRoles = this.roomAccessRules[zone.id] || [];
                const canAccess = allowedRoles.includes(myRole);

                if (!canAccess) {
                    return { allowed: false, zone };
                }
            }
        }
        return { allowed: true };
    }
}
