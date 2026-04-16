import { jest } from '@jest/globals';
import { PlayerStateStore } from '../src/stateManagement.js';

describe('Player Session State Management', () => {
    let store;
    
    beforeEach(() => {
        store = new PlayerStateStore();
    });

    describe('Adding Players to Instance', () => {
        it('should successfully add a new player to the empty store', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            expect(store.players['id1']).toBeDefined();
            expect(store.players['id1'].username).toBe('Alice');
        });
        it('should properly track the total player count dynamically', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            store.addPlayer('id2', 'Bob', 30, 40);
            expect(store.getPlayerCount()).toBe(2);
        });
        it('should throw an error if player ID already exists to prevent duplication collisions', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            expect(() => store.addPlayer('id1', 'AliceClone', 0, 0)).toThrow('Player already exists');
        });
    });

    describe('Updating State Positions During Movement', () => {
        it('should successfully update X and Y coordinates for existing player', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            const success = store.updatePosition('id1', 50, 50);
            expect(success).toBe(true);
            expect(store.players['id1'].x).toBe(50);
        });
        it('should gracefully fail when updating a non-existent player ensuring pure stability', () => {
            expect(store.updatePosition('ghost_id', 50, 50)).toBe(false);
        });
        it('should preserve other core properties (username, etc) when altering mutable physics state', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            store.updatePosition('id1', 50, 50);
            expect(store.players['id1'].username).toBe('Alice');
            expect(store.players['id1'].active).toBe(true);
        });
    });

    describe('Removing External Sessions', () => {
        it('should successfully destruct an existing player from active state upon disconnection', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            expect(store.removePlayer('id1')).toBe(true);
            expect(store.players['id1']).toBeUndefined();
        });
        it('should restructure player count correctly upon systematic removal', () => {
            store.addPlayer('id1', 'Alice', 10, 20);
            store.addPlayer('id2', 'Bob', 30, 40);
            store.removePlayer('id1');
            expect(store.getPlayerCount()).toBe(1);
        });
        it('should return false boolean block if trying to remove an already disconnected player', () => {
            expect(store.removePlayer('ghost_id')).toBe(false);
        });
    });
});
