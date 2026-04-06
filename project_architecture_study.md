# Metaverse Project Architecture & File Interactions

This document outlines the high-level architecture of your 2D Metaverse project, detailing how the React frontend, Phaser game engine, Node.js backend, and various modules interact to create a real-time multiplayer virtual office.

## 🏗️ 1. High-Level Architecture

Your project follows a robust Client-Server architecture, divided into three main operational layers:

1.  **Frontend (React UI)**: Manages authentication, menus, video grids, modals, notifications, routing (`react-router-dom`), and overlays the game canvas.
2.  **Game Engine (Phaser 3)**: Manages the 2D world, tilemaps, physics (collisions), sprite rendering, movement interpolations, and line-of-sight calculations.
3.  **Backend (Node.js + Express + Socket.io)**: Manages global state, persistent storage (MongoDB), WebRTC signaling (`PeerJS`), and background processing (`BullMQ` + `Redis`).

---

## 📂 2. File & Component Breakdown

### 🖥️ Client - Frontend UI (`/client/src/`)
-   **`App.jsx`**: The root component. Handles routing (`/login`, `/signup`, `/metaverse`). Wraps the app in Context Providers (`AuthContext`, `NotificationContext`).
-   **`components/ui/` & Others**: React components overlaying the game canvas. For example:
    -   `ComputerModal.jsx`: Represents screen-sharing or task interaction at virtual desks.
    -   `VideoGrid.jsx` / `VoiceChat.jsx`: Built-in WebRTC (PeerJS/LiveKit) interfaces.
    -   `ChatSidebar.jsx`: World-wide and private text chatting logic.
-   **`services/socketService.js`**: A singleton wrapper that manages the `socket.io-client` connection.
-   **`services/peerService.js`**: A singleton that wraps the `PeerJS` logic to establish peer-to-peer audio/video connections.

### 🎮 Client - Phaser Engine (`/client/src/phaser/`)
These files orchestrate the actual virtual world logic:
-   **`scenes/World.js`**: The main game scene. Bootstraps the map, spawns the local player, and initializes all "Managers". It contains the core update loop (`update(time, delta)`) which constantly throttles audio changes and movement syncing.
-   **`managers/MapManager.js`**: Loads `Tiled` `.tmj` maps. It defines the layout of the world, handles wall collisions, and sets up interaction zones (e.g., meeting rooms, working desks).
-   **`managers/NetworkManager.js`**: The bridge between Phaser and `socketService.js`. It subscribes to socket events (e.g., `onPlayerJoined`, `onPlayerMoved`) and updates the state of avatars on the map.
-   **`managers/PlayerManager.js`**: Handles drawing dynamic sprites and labels (e.g., "Working..." tags or usernames).
-   **`managers/VoiceManager.js`**: Handles proximity spatial audio. It adjusts the volume of `HTMLAudioElements` based on the distance calculated between player sprites.
-   **`managers/InputManager.js`**: Converts keyboard bindings into directional commands.

### 🛠️ Server - Backend API (`/server/`)
-   **`index.js`**: The entry point. Connects to MongoDB, initializes the Express server, mounts the PeerJS server, registers Express routes (`/api/auth`, `/api/meeting`), and binds Socket.io.
-   **`models/`**: Mongoose schemas defining your database:
    -   `User.js`: Credentials, roles (admin/employee), and the last saved `x,y` map coordinates.
    -   `MeetingRecord.js` & `MeetingTranscript.js`: Used to store long-running records of meetings and Speech-To-Text logs.
-   **`socket/socketHandler.js`**: The crucial backbone for multiplayer synchronous interactions. It manages an active `players` dictionary (with socket IDs) and handles commands like joining the game, moving, entering "work mode," and establishing "proximity calls".
-   **`services/momWorker.js`**: A BullMQ asynchronous worker connected to Redis. It takes transcripts saved from active meetings and chunks them to `Groq's Llama-3.1 AI Model` to generate dynamic Minutes of Meeting summaries (`momContent`), offloading the heavy processing from the main server loop.

---

## 🔄 3. How Core Interactions Flow

To understand the connection between these files, here are a few step-by-step lifecycles map:

### Scenario A: Player Connects to Game
1.  **React**: User successfully logs in via `LoginPage.jsx` and transitions to `/metaverse`.
2.  **Phaser (`World.js`)**: `WorldScene.create()` is called. It loads the `MapManager` and instantiates `NetworkManager`.
3.  **Client Socket (`World.js`)**: Tells `socketService.js` to connect to the backend. emits `joinGame(username)`.
4.  **Server Socket (`socketHandler.js`)**: Validates the `username` via MongoDB (`User.js`), looks up `lastX` and `lastY`, assigns them to the session, and broadcasts `playerJoined` to everyone else in the server.
5.  **Client Socket (`NetworkManager.js`)**: Other clients receive `onPlayerJoined`, delegating to `PlayerManager.js`, which plots a new avatar onto their map.

### Scenario B: Movement & Proximity Voice Calling
1.  **Client Input**: User presses `W`. `InputManager.js` detects the key press.
2.  **Phaser Update (`World.js`)**: Throttled updates are sent every `~100ms` from `NetworkManager.sendMovementUpdate()` via `socketService.emitMove({x, y, anim})`.
3.  **Server Socket**: `socketHandler.js` instantly broadcasts the `{x, y}` to all peers.
4.  **Proximity (`NetworkManager.js`)**: Based on an interval, the `getNearbyPlayersToEmit()` measures spatial distances within the map using Raycasting physics to ensure visibility (no walls blocking sound).
5.  **Voice Invocation**: Nearby candidates are sent to the backend, returning `initiateProximityCalls`. `peerService.js` is then fired to dial the peers up via WebRTC, allowing line-of-sight proximity voice interactions while adjusting volumes dynamically (`VoiceManager.js`).

### Scenario C: Minutes of Meeting (MOM) Generation
1.  **Frontend Notification**: Meeting ends. The client can trigger an API call to `/api/meeting/generate-mom`.
2.  **Express Route**: Places a Job payload into `momQueue` (`BullMQ`/Redis interface).
3.  **Background Worker (`momWorker.js`)**: In an isolated process, the worker wakes up. It fetches all `MeetingTranscript.js` data matching the `sessionId`.
4.  **AI Invocation**: It calls `Groq LLM/Llama 3` via an API request utilizing an organized prompt string to summarize the transcripts.
5.  **Storage**: Modifies the `momStatus` to 'Generated' and saves the result natively in `MeetingRecord.js`. React Frontend pools or receives real-time validation to display the result.
