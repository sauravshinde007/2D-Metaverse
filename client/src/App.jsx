import { useEffect } from "react";
import "./App.css";
import startGame from "./phaser";
import HUD from "./components/HUD";

function App() {
  useEffect(() => {
    if (window._phaserGame) return;
    const game = startGame();
    window._phaserGame = game;

    return () => {
      if (window._phaserGame) {
        window._phaserGame.destroy(true);
        window._phaserGame = null;
      }
    };
  }, []);

  return (
    <div className="app-root">
      {/* Game fills available space */}
      <div id="game-container" className="game-container" />

     <div className="hud-root">
        <HUD />
    </div>
    </div>
  );
}

export default App;