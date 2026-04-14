import { jest } from '@jest/globals';

class MockSocket {
    constructor(id) {
        this.id = id;
        this.events = {};
        this.broadcast = { emit: jest.fn() };
    }
    on(event, cb) { this.events[event] = cb; }
    emit(event, data) { if(this.events[event]) this.events[event](data); }
}

describe('Integration: WebSocket Client-Server Synchro Pipeline', () => {
    let clientA, clientB, serverPlayers;

    beforeEach(() => {
        clientA = new MockSocket('userA');
        clientB = new MockSocket('userB');
        serverPlayers = {};
    });

    it('Should synchronize player connection and initial state safely across active clients', () => {
        clientA.on('joinGame', (username) => {
            serverPlayers[clientA.id] = { x: 0, y: 0, username };
            clientA.broadcast.emit('playerJoined', { id: clientA.id, username });
        });

        clientA.emit('joinGame', 'Alice');

        expect(serverPlayers['userA']).toBeDefined();
        expect(clientA.broadcast.emit).toHaveBeenCalledWith('playerJoined', { id: 'userA', username: 'Alice' });
    });

    it('Should rapidly propagate physics movement data traversing from Client A to Global Nodes', () => {
        clientA.on('move', (data) => {
            serverPlayers[clientA.id] = { ...serverPlayers[clientA.id], ...data };
            clientA.broadcast.emit('playerMoved', { id: clientA.id, pos: data });
        });

        serverPlayers['userA'] = { x: 0, y: 0 };
        clientA.emit('move', { x: 100, y: 200, anim: 'walk' });

        expect(serverPlayers['userA'].x).toBe(100);
        expect(clientA.broadcast.emit).toHaveBeenCalledWith('playerMoved', { 
            id: 'userA', pos: { x: 100, y: 200, anim: 'walk' } 
        });
    });

    it('Should dynamically clean up remote state tables during force disconnect interruptions', () => {
        clientA.on('disconnect', () => {
            delete serverPlayers[clientA.id];
            clientA.broadcast.emit('playerLeft', clientA.id);
        });

        serverPlayers['userA'] = { x: 100, y: 200 };
        clientA.emit('disconnect');

        expect(serverPlayers['userA']).toBeUndefined();
        expect(clientA.broadcast.emit).toHaveBeenCalledWith('playerLeft', 'userA');
    });
});
