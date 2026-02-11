
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
    }

    create() {
        this.map = this.scene.make.tilemap({ key: "office-map" });

        // Tilesets
        const roomTileset = this.map.addTilesetImage("Room_Builder_free_32x32", "room-tiles");
        const interiorTileset = this.map.addTilesetImage("Interiors_free_32x32", "interior-tiles");
        const officeTileset = this.map.addTilesetImage("Modern_Office_Black_Shadow", "office-tiles");
        const roomfloorTileset = this.map.addTilesetImage("Room_Builder_Floors", "room-floor");
        const allTilesets = [interiorTileset, roomTileset, officeTileset, roomfloorTileset];

        // Layers
        this.layers.ground = this.map.createLayer("Ground", allTilesets, 0, 0);
        this.layers.walls = this.map.createLayer("Wall", allTilesets, 0, 0);
        this.layers.props = this.map.createLayer("Props", allTilesets, 0, 0);
        this.layers.props1 = this.map.createLayer("Props1", allTilesets, 0, 0);
        this.layers.props2 = this.map.createLayer("Props2", allTilesets, 0, 0);

        // Depth
        this.layers.ground.setDepth(0);
        this.layers.walls.setDepth(1);
        this.layers.props.setDepth(2);
        this.layers.props1.setDepth(3);
        this.layers.props2.setDepth(4);

        // Collisions
        this.layers.walls.setCollisionByProperty({ collides: true });
        this.layers.props.setCollisionByProperty({ collides: true });
        this.layers.props1.setCollisionByProperty({ collides: true });
        this.layers.props2.setCollisionByProperty({ collides: true });

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
    }

    registerRaycaster(raycasterPlugin) {
        if (raycasterPlugin) {
            raycasterPlugin.mapGameObjects(
                [this.layers.walls, this.layers.props, this.layers.props1, this.layers.props2],
                true
            );
            console.log("✅ Raycaster mapped to collision layers");
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
