export class PlayerStateStore {
    constructor() {
        this.players = {};
    }
    
    addPlayer(id, username, startX, startY) {
        if (this.players[id]) throw new Error('Player already exists in session');
        this.players[id] = { username, x: startX, y: startY, active: true };
    }
    
    updatePosition(id, x, y) {
        if (!this.players[id]) return false;
        this.players[id].x = x;
        this.players[id].y = y;
        return true;
    }
    
    removePlayer(id) {
        if (!this.players[id]) return false;
        delete this.players[id];
        return true;
    }

    getPlayerCount() {
        return Object.keys(this.players).length;
    }
}
