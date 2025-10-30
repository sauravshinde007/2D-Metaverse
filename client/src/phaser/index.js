// client/src/phaser/index.js
import Phaser from "phaser";
import WorldScene from "./scenes/World";
// TestScene is not used in this flow, so it can be removed if not needed elsewhere
// import TestScene from "./scenes/Test";

export default function startGame(username) {
  const container = document.getElementById("game-container");
  if (!container) {
    console.warn("No #game-container found");
    return null;
  }

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
    // MODIFICATION: The scene is no longer auto-started here
    scene: [],
  };

  const game = new Phaser.Game(config);

  // MODIFICATION: Manually add the scene and then start it with the username data.
  // This is the correct way to pass data to a scene on startup.
  game.scene.add('WorldScene', WorldScene);
  game.scene.start('WorldScene', { username: username });

  // Expose globally for HUD
  window.game = game;
  window._phaserGame = game;

  const handleResize = () => {
    if (container && game && game.scale) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      game.scale.resize(width, height);
      if (game.canvas) {
        game.canvas.style.width = width + "px";
        game.canvas.style.height = height + "px";
      }
    }
  };

  handleResize();
  window.addEventListener("resize", handleResize);

  game.events.on("destroy", () => {
    window.removeEventListener("resize", handleResize);
    if (window._phaserGame === game) window._phaserGame = null;
  });

  return game;
}