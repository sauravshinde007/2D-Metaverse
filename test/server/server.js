import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { createClient } from "@deepgram/sdk";
import cors from "cors";

dotenv.config();


// =============================
// Setup
// =============================
const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});


// =============================
// Deepgram
// =============================
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

let dgConnection = null;
let transcriptStore = "";


// =============================
// Start STT
// =============================
async function startDeepgram() {

  if (dgConnection) return;

  console.log("Starting Deepgram...");

  dgConnection = await deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    punctuate: true,
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
  });


  dgConnection.on("open", () => {
    console.log("Deepgram connected");
  });


  dgConnection.on("transcript", (data) => {

    const text =
      data.channel?.alternatives?.[0]?.transcript;

    if (text && text.length > 0) {

      console.log("Transcript:", text);

      transcriptStore += text + ". ";
    }
  });


  dgConnection.on("close", () => {

    console.log("Deepgram closed");

    dgConnection = null;
  });


  dgConnection.on("error", (err) => {
    console.error("Deepgram error:", err);
  });
}


// =============================
// Stop STT
// =============================
function stopDeepgram() {

  if (!dgConnection) return;

  dgConnection.finish();

  dgConnection = null;

  console.log("Deepgram stopped");
}


// =============================
// Socket
// =============================
io.on("connection", (socket) => {

  console.log("Client connected:", socket.id);


  startDeepgram();


  socket.on("audio", async (data) => {

    if (!dgConnection) return;

    if (dgConnection.readyState !== 1) return;


    // Float32 → PCM16
    const float32 = new Float32Array(data.chunk);

    const pcm16 = new Int16Array(float32.length);


    for (let i = 0; i < float32.length; i++) {

      let s = Math.max(-1, Math.min(1, float32[i]));

      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }


    const buffer = Buffer.from(pcm16.buffer);

    dgConnection.send(buffer);
  });


  socket.on("disconnect", () => {

    console.log("Client disconnected:", socket.id);

    stopDeepgram();
  });
});


// =============================
// MOM (Transcript)
// =============================
app.get("/api/mom", (req, res) => {

  res.json({
    mom: transcriptStore || "No transcript yet",
  });
});


// =============================
server.listen(5000, () => {
  console.log("Live STT Server running on 5000");
});
