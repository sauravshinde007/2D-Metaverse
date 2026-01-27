import express from "express";
import cors from "cors";
import bodyParser from "body-parser";




const app = express();
const PORT = 4000;

// ================================
// Middleware
// ================================
app.use(cors());
app.use(bodyParser.json());

// ================================
// Store transcript (TEMP)
// ================================
let transcript = [];

// ================================
// Receive transcript
// ================================
app.post("/api/transcript", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text required" });
  }

  console.log("Heard:", text);

  transcript.push(text);

  res.json({ success: true });
});

// ================================
// Generate MOM (LLM)
// ================================
app.get("/api/mom", (req, res) => {

  if (transcript.length === 0) {
    return res.json({
      mom: "No transcript recorded yet.",
    });
  }

  const momText = transcript.join("\n");

  // Clear after sending (optional)
  transcript = [];

  res.json({
    mom: momText,
  });
});

// ================================
app.listen(PORT, () => {
  console.log(`Test server running on ${PORT}`);
});
