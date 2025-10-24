// server/utils/proximity.js

/**
 * Get nearby player IDs within a certain distance threshold.
 * Can be used for proximity chat, rendering, or events.
 */
export function getNearbyPlayers(players, currentId, range = 400) {
  const current = players[currentId];
  if (!current) return [];

  const nearby = [];

  for (const [id, player] of Object.entries(players)) {
    if (id === currentId) continue;

    const dx = player.x - current.x;
    const dy = player.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= range) {
      nearby.push(id);
    }
  }

  return nearby;
}
