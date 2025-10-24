import Phaser from "phaser";
import WorldScene from "./scenes/World";
import TestScene from "./scenes/Test";


export default function startGame() {
  const container = document.getElementById("game-container");
  if (!container) {
    console.warn("No #game-container found");
    return null;
  }

  // Clear previous Phaser instance if any
  if (window._phaserGame) {
    window._phaserGame.destroy(true);
    window._phaserGame = null;
    container.innerHTML = "";
  }

  const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    transparent: true,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scene: [WorldScene],
  };

  const game = new Phaser.Game(config);

  // Expose globally for HUD
  window.game = game;
  window._phaserGame = game;

  // Keep canvas in sync with container size
  const handleResize = () => {
    if (container && game && game.scale) {
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Update game dimensions
      game.scale.resize(width, height);

      // Force canvas to match container size
      if (game.canvas) {
        game.canvas.style.width = width + "px";
        game.canvas.style.height = height + "px";
      }
    }
  };

  // Call it once on mount to sync immediately
  handleResize();

  window.addEventListener("resize", handleResize);

  game.events.on("destroy", () => {
    window.removeEventListener("resize", handleResize);
    if (window._phaserGame === game) window._phaserGame = null;
  });

  return game;
}
