import { StreamChat } from "stream-chat";
import { getNearbyPlayers } from "./proximity.js";

export const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// --- Global Room ---
export async function getGlobalRoom() {
  const channel = serverClient.channel("messaging", "global-room", {
    name: "Global Room",
  });
try {
  await channel.create();
} catch (err) {
  if (err?.code !== 16) { // 16 = channel already exists
    throw err;
  }
}

  return channel;
}

// --- Proximity Chat ---
export async function createProximityChat(players, socketId, range = 400) {
  const nearbyIds = getNearbyPlayers(players, socketId, range);
  if (!nearbyIds.length) return null;

  const members = [socketId, ...nearbyIds].sort();
  const channelId = `proximity-${members.join("-")}`;

  const channel = serverClient.channel("messaging", channelId, {
    name: `Nearby Chat (${members.length})`,
    members,
    private: true,
  });

  try {
    await channel.create();
  } catch (err) {
    if (err?.code !== 16) {
      throw err;
    }
  }

  return channel;
}

// --- Token Generation ---
export function generateToken(userId) {
  return serverClient.createToken(userId);
}
