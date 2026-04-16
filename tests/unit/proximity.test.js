import { jest } from '@jest/globals';
import { calculateDistance, checkLineOfSight, getNearbyPlayers } from '../src/proximity.js';

describe('Proximity & Line-of-Sight Module', () => {
    let localPlayer;
    
    beforeEach(() => {
        localPlayer = { id: 'p1', x: 100, y: 100 };
    });

    describe('Distance Calculations', () => {
        it('should return 0 for identical coordinates', () => {
            expect(calculateDistance(localPlayer, { x: 100, y: 100 })).toBe(0);
        });
        it('should calculate correct horizontal distance', () => {
            expect(calculateDistance(localPlayer, { x: 150, y: 100 })).toBe(50);
        });
        it('should calculate correct vertical distance', () => {
            expect(calculateDistance(localPlayer, { x: 100, y: 50 })).toBe(50);
        });
        it('should calculate correct diagonal distance', () => {
            expect(calculateDistance(localPlayer, { x: 130, y: 140 })).toBe(50);
        });
        it('should handle negative coordinates correctly', () => {
            expect(calculateDistance({ x: -50, y: -50 }, { x: -50, y: -100 })).toBe(50);
        });
    });

    describe('Line of Sight Testing', () => {
        let mockWall;
        beforeEach(() => mockWall = { blocks: jest.fn() });

        it('should return true if no walls exist', () => {
            expect(checkLineOfSight(localPlayer, { x: 200, y: 200 }, [])).toBe(true);
        });
        it('should return false if wall intersects the line of sight', () => {
            mockWall.blocks.mockReturnValue(true);
            expect(checkLineOfSight(localPlayer, { x: 200, y: 200 }, [mockWall])).toBe(false);
        });
        it('should return true if wall exists but is not blocking', () => {
            mockWall.blocks.mockReturnValue(false);
            expect(checkLineOfSight(localPlayer, { x: 200, y: 200 }, [mockWall])).toBe(true);
        });
        it('should process multiple walls correctly, failing fast', () => {
            const wall2 = { blocks: jest.fn().mockReturnValue(true) };
            mockWall.blocks.mockReturnValue(false);
            expect(checkLineOfSight(localPlayer, { x: 200, y: 200 }, [mockWall, wall2])).toBe(false);
            expect(wall2.blocks).toHaveBeenCalled();
        });
    });

    describe('Nearby Player Filtering Validations', () => {
        it('should not include the local player in the nearby list', () => {
            const nearby = getNearbyPlayers(localPlayer, [localPlayer], 100, []);
            expect(nearby.length).toBe(0);
        });
        it('should include players within numerical proximity limits', () => {
            const other = { id: 'p2', x: 120, y: 120 };
            const nearby = getNearbyPlayers(localPlayer, [other], 50, []);
            expect(nearby.length).toBe(1);
            expect(nearby[0].id).toBe('p2');
        });
        it('should drop players outside coordinate threshold', () => {
            const other = { id: 'p2', x: 300, y: 300 };
            const nearby = getNearbyPlayers(localPlayer, [other], 50, []);
            expect(nearby.length).toBe(0);
        });
        it('should exclude players that are blocked by walls within radius', () => {
            const other = { id: 'p2', x: 120, y: 120 };
            const blocker = { blocks: () => true };
            const nearby = getNearbyPlayers(localPlayer, [other], 50, [blocker]);
            expect(nearby.length).toBe(0);
        });
        it('should handle large multi-user environments efficiently', () => {
            const others = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}`, x: 100 + i, y: 100 }));
            const nearby = getNearbyPlayers(localPlayer, others, 20, []);
            expect(nearby.length).toBe(21); 
        });
    });
});
