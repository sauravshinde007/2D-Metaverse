// phaser/input/InputManager.js
export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.gameInputEnabled = true;
    this.chatFocused = false;

    // Input mapping configuration
    this.keyMappings = {
      game: {
        MOVE_UP: ["W", "ArrowUp"],
        MOVE_DOWN: ["S", "ArrowDown"],
        MOVE_LEFT: ["A", "ArrowLeft"],
        MOVE_RIGHT: ["D", "ArrowRight"],
        INTERACT: ["E", "Space"],
      },
      ui: {
        CONFIRM: ["Enter"],
        CANCEL: ["Escape"],
      },
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for chat focus changes from React
    window.addEventListener("chat-focus-change", (e) => {
      this.chatFocused = e.detail.focused;
      this.setGameInputEnabled(!e.detail.focused);
    });

    // Keyboard input
    this.scene.input.keyboard.on("keydown", (event) => {
      this.handleKeyDown(event);
    });

    this.scene.input.keyboard.on("keyup", (event) => {
      this.handleKeyUp(event);
    });
  }

  handleKeyDown(event) {
    if (this.chatFocused) return;
    if (!this.gameInputEnabled) return;

    const gameAction = this.getActionForKey(event.key, "game");
    if (gameAction) {
      this.forwardToGame("keydown", event, gameAction);
    }
  }

  handleKeyUp(event) {
    if (this.chatFocused) return;
    if (!this.gameInputEnabled) return;

    const gameAction = this.getActionForKey(event.key, "game");
    if (gameAction) {
      this.forwardToGame("keyup", event, gameAction);
    }
  }

  getActionForKey(key, context) {
    for (const [action, keys] of Object.entries(this.keyMappings[context])) {
      if (keys.map((k) => k.toUpperCase()).includes(key.toUpperCase())) {
        return action;
      }
    }
    return null;
  }

  forwardToGame(eventType, data, action) {
    this.scene.events.emit(`gameInput`, {
      type: eventType,
      data: data,
      action: action,
    });
  }
  
  setGameInputEnabled(enabled) {
    this.gameInputEnabled = enabled;
    console.log(`Game input ${enabled ? "enabled" : "disabled"}`);
  }

  destroy() {
    // Clean up listeners if you add more global ones later
  }
}