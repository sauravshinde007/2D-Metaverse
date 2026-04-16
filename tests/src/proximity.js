export const calculateDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

export const checkLineOfSight = (p1, p2, walls) => {
    for (let wall of walls) {
        if (wall.blocks(p1, p2)) return false;
    }
    return true;
};

export const getNearbyPlayers = (localPlayer, allPlayers, radius, walls) => {
    return allPlayers.filter(p => {
        if (p.id === localPlayer.id) return false;
        const dist = calculateDistance(localPlayer, p);
        return dist <= radius && checkLineOfSight(localPlayer, p, walls);
    });
};
