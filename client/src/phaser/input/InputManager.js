// phaser/input/InputManager.js
export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.gameInputEnabled = true;
        this.chatFocused = false;
        
        // Input mapping configuration
        this.keyMappings = {
            game: {
                MOVE_UP: ['W', 'ArrowUp'],
                MOVE_DOWN: ['S', 'ArrowDown'],
                MOVE_LEFT: ['A', 'ArrowLeft'],
                MOVE_RIGHT: ['D', 'ArrowRight'],
                INTERACT: ['E', 'Space']
            },
            ui: {
                CONFIRM: ['Enter'],
                CANCEL: ['Escape']
            }
        };
        
        this.setupEventListeners();
        this.setupFocusHandler();
    }
    
    setupEventListeners() {
        // Listen for React HUD toggle events
        window.addEventListener("game-input-toggle", (e) => {
            this.setGameInputEnabled(e.detail.enabled);
        });
        
        // Listen for chat focus changes from React
        window.addEventListener("chat-focus-change", (e) => {
            this.chatFocused = e.detail.focused;
            this.setGameInputEnabled(!e.detail.focused);
        });
        
        // Keyboard input
        this.scene.input.keyboard.on('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        this.scene.input.keyboard.on('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    setupFocusHandler() {
        // Handle document clicks to detect when to unfocus chat
        document.addEventListener('click', (e) => {
            this.handleDocumentClick(e);
        });
        
        // Also handle focus events on inputs
        document.addEventListener('focusin', (e) => {
            this.handleFocusIn(e);
        });
    }
    
    handleDocumentClick(e) {
        // If chat is focused and we clicked outside of chat, unfocus it
        if (this.chatFocused) {
            const chatElements = document.querySelectorAll('.hud-root, .hud-root *');
            let clickedOnChat = false;
            
            chatElements.forEach(element => {
                if (element.contains(e.target)) {
                    clickedOnChat = true;
                }
            });
            
            if (!clickedOnChat) {
                // Clicked outside of chat, so unfocus it
                window.dispatchEvent(new CustomEvent('chat-focus-change', {
                    detail: { focused: false }
                }));
                
                // Blur any active input elements
                if (document.activeElement && 
                   (document.activeElement.tagName === 'TEXTAREA' || 
                    document.activeElement.tagName === 'INPUT')) {
                    document.activeElement.blur();
                }
            }
        }
    }
    
    handleFocusIn(e) {
        // If an input inside chat gains focus, make sure chat is focused
        const chatElements = document.querySelectorAll('.hud-root, .hud-root *');
        let focusedOnChat = false;
        
        chatElements.forEach(element => {
            if (element.contains(e.target)) {
                focusedOnChat = true;
            }
        });
        
        if (focusedOnChat && !this.chatFocused) {
            window.dispatchEvent(new CustomEvent('chat-focus-change', {
                detail: { focused: true }
            }));
        }
    }
    
    handleKeyDown(event) {
        // If chat is focused, don't process game inputs
        if (this.chatFocused) {
            return;
        }
        
        // Check if this is a UI-focused key
        const uiAction = this.getActionForKey(event.key, 'ui');
        if (uiAction && this.shouldSendToUI(event)) {
            this.forwardToUI('keydown', event, uiAction);
            return;
        }
        
        // Otherwise, send to game controls if enabled
        if (this.gameInputEnabled) {
            const gameAction = this.getActionForKey(event.key, 'game');
            if (gameAction) {
                this.forwardToGame('keydown', event, gameAction);
            }
        }
    }
    
    handleKeyUp(event) {
        // If chat is focused, don't process game inputs
        if (this.chatFocused) {
            return;
        }
        
        if (this.gameInputEnabled) {
            const gameAction = this.getActionForKey(event.key, 'game');
            if (gameAction) {
                this.forwardToGame('keyup', event, gameAction);
            }
        }
    }
    
    getActionForKey(key, context) {
        for (const [action, keys] of Object.entries(this.keyMappings[context])) {
            if (keys.map(k => k.toUpperCase()).includes(key.toUpperCase())) {
                return action;
            }
        }
        return null;
    }
    
    shouldSendToUI(event) {
        // Always send UI-specific keys to UI, regardless of focus
        const uiKeys = Object.values(this.keyMappings.ui).flat();
        return uiKeys.map(k => k.toUpperCase()).includes(event.key.toUpperCase());
    }
    
    forwardToGame(eventType, data, action) {
        this.scene.events.emit(`gameInput`, {
            type: eventType,
            data: data,
            action: action
        });
    }
    
    forwardToUI(eventType, data, action) {
        window.dispatchEvent(new CustomEvent('uiInput', {
            detail: {
                type: eventType,
                data: data,
                action: action
            }
        }));
    }
    
    setGameInputEnabled(enabled) {
        this.gameInputEnabled = enabled;
        this.chatFocused = !enabled;
        console.log(`Game input ${enabled ? 'enabled' : 'disabled'}`);
    }
}