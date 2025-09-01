import { useState, useEffect } from 'react'
import './App.css'
import startGame from "./phaser";
import HUD from './components/HUD';

function App() {
  useEffect(() => {
    const game = startGame();
    return () => game.destroy(true);
  }, []);

  return (
    <>
      <div className="w-screen h-screen relative">
      {/* Phaser canvas */}
      <div id="game-container" className="w-full h-full" />

      {/* React overlay HUD */}
      <HUD />
    </div>
    </>
  )
}

export default App
