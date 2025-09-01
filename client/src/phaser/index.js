import Phaser from 'phaser';
import WorldScene from './scenes/World';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "game-container", // div id in App.jsx
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [WorldScene],
};

export default function startGame() {
  return new Phaser.Game(config);
}