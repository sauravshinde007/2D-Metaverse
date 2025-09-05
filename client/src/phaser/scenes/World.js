import Phaser from "phaser";
import { io } from "socket.io-client";

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
  }

  preload() {
    // ✅ Don't include /public — everything inside public/ is served from root
    this.load.image("background", "/assets/steptodown.com169408.jpg");
    this.load.image("player", "https://labs.phaser.io/assets/sprites/phaser-dude.png");
  }

  create() {
    this.socket = io("http://localhost:3001");

    // ✅ background
    this.background = this.add.image(0, 0, "background").setOrigin(0, 0);
    this.background.setDisplaySize(1920, 1080);

    // ✅ world + camera bounds
    this.cameras.main.setBounds(0, 0, this.background.displayWidth, this.background.displayHeight);
    this.physics.world.setBounds(0, 0, this.background.displayWidth, this.background.displayHeight);

    this.players = {}; // store other players

    // ✅ spawn local player
    this.player = this.add.sprite(400, 300, "player");

    // ✅ camera follows local player
    this.cameras.main.startFollow(this.player);

    // input
    this.cursors = this.input.keyboard.createCursorKeys();

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
  }

  addOtherPlayer(id, pos) {
    const other = this.add.sprite(pos.x, pos.y, "player").setTint(0xff0000);
    this.players[id] = other;
  }

  update() {
    const speed = 200;
    const delta = this.game.loop.delta / 1000;

    let dx = 0,
      dy = 0;
    if (this.cursors.left.isDown) dx = -1;
    if (this.cursors.right.isDown) dx = 1;
    if (this.cursors.up.isDown) dy = -1;
    if (this.cursors.down.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      this.player.x += dx * speed * delta;
      this.player.y += dy * speed * delta;

      // send position to server
      this.socket.emit("move", { x: this.player.x, y: this.player.y });
    }
  }
}
